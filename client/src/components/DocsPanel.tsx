import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import { CollaborationCaret as CollaborationCursor } from '@tiptap/extension-collaboration-caret';
import type { WebsocketProvider } from 'y-websocket';
import type * as Y from 'yjs';
import {
  createDoc,
  deleteDoc,
  getDoc,
  listDocs,
  updateDoc,
  type Doc,
  type DocSummary,
} from '../api/doc';
import type { MeUser } from '../api/auth';
import { useCollabDoc, type CollabStatus } from '../collab/useCollabDoc';

interface TreeNode extends DocSummary {
  children: TreeNode[];
}

function buildTree(docs: DocSummary[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const doc of docs) {
    nodes.set(doc.id, { ...doc, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const doc of docs) {
    const node = nodes.get(doc.id)!;
    const parent = doc.parentDocId ? nodes.get(doc.parentDocId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function collectRemoved(docs: DocSummary[], rootId: string): Set<string> {
  const removed = new Set<string>([rootId]);
  let growing = true;
  while (growing) {
    growing = false;
    for (const doc of docs) {
      if (doc.parentDocId && removed.has(doc.parentDocId) && !removed.has(doc.id)) {
        removed.add(doc.id);
        growing = true;
      }
    }
  }
  return removed;
}

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

function parseDocContent(raw: string): JSONContent {
  const blank: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
  if (!raw) return blank;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as JSONContent).type === 'doc' &&
      Array.isArray((parsed as JSONContent).content)
    ) {
      return parsed as JSONContent;
    }
  } catch {
    // 旧文档或非法 JSON：按纯文本处理
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: raw }],
      },
    ],
  };
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function UndoIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-2" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg {...iconProps}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h2" />
    </svg>
  );
}

function ListIcon({ ordered }: { ordered: boolean }) {
  return (
    <svg {...iconProps}>
      <path d="M9 6h12M9 12h12M9 18h12" />
      {ordered ? (
        <>
          <text x="1.5" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
          <text x="1.5" y="14" fontSize="7" fill="currentColor" stroke="none">2</text>
          <text x="1.5" y="20" fontSize="7" fill="currentColor" stroke="none">3</text>
        </>
      ) : (
        <>
          <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg {...iconProps}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
    </svg>
  );
}

function RuleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 12h16" />
    </svg>
  );
}

function Glyph({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontSize: 14, lineHeight: 1, ...style }}>{children}</span>;
}

const editorStyles = `
.zcollab-editor {
  box-sizing: border-box;
  min-height: 400px;
  padding: 12px 14px;
  border: 1px solid var(--mantine-color-gray-3);
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
  color: var(--mantine-color-text);
  outline: none;
}
.zcollab-editor:focus-within { border-color: var(--mantine-color-teal-5); }
.zcollab-editor p { margin: 0; }
.zcollab-editor > * + * { margin-top: 0.75em; }
.zcollab-editor h1, .zcollab-editor h2, .zcollab-editor h3 { font-weight: 700; line-height: 1.3; margin: 1em 0 0.5em; }
.zcollab-editor h1 { font-size: 2em; }
.zcollab-editor h2 { font-size: 1.6em; }
.zcollab-editor h3 { font-size: 1.3em; }
.zcollab-editor ul, .zcollab-editor ol { padding-left: 1.8em; margin: 0.5em 0; }
.zcollab-editor ul { list-style: disc; }
.zcollab-editor ol { list-style: decimal; }
.zcollab-editor li { margin: 0.25em 0; }
.zcollab-editor li p { margin: 0; }
.zcollab-editor blockquote { margin: 0.75em 0; padding: 2px 0 2px 14px; border-left: 3px solid var(--mantine-color-gray-4); color: var(--mantine-color-dimmed); }
.zcollab-editor pre { margin: 0.75em 0; padding: 12px 14px; border-radius: 6px; background: var(--mantine-color-gray-1); overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.6; }
.zcollab-editor code { padding: 0.15em 0.35em; border-radius: 4px; background: var(--mantine-color-gray-1); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.zcollab-editor pre code { padding: 0; background: transparent; }
.zcollab-editor hr { border: 0; border-top: 1px solid var(--mantine-color-gray-3); margin: 1.5em 0; }
.zcollab-editor .collaboration-carets__caret {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 2px solid;
  border-right: 2px solid;
  pointer-events: none;
  word-break: normal;
}
.zcollab-editor .collaboration-carets__label {
  position: absolute;
  top: -1.5em;
  left: -1px;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  color: #fff;
  padding: 1px 5px;
  border-radius: 3px 3px 3px 0;
  user-select: none;
  white-space: nowrap;
}
`;

interface NodeRowProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}

function NodeRow({ node, depth, selectedId, onSelect, onDelete }: NodeRowProps) {
  const [hovered, setHovered] = useState(false);
  const isSelected = node.id === selectedId;

  return (
    <Group
      gap={4}
      wrap="nowrap"
      py={6}
      px="xs"
      bg={isSelected ? 'teal.0' : hovered ? 'gray.0' : undefined}
      style={{ borderRadius: 6, cursor: 'pointer', paddingLeft: 8 + depth * 16 }}
      onClick={() => onSelect(node.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text size="sm" fw={isSelected ? 600 : 400} c={isSelected ? 'teal.8' : undefined} truncate style={{ flex: 1 }}>
        {node.title || '无标题'}
      </Text>
      {hovered && (
        <ActionIcon
          size="compact-xs"
          variant="subtle"
          color="red"
          aria-label="删除文档"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(node.id, node.title);
          }}
        >
          ×
        </ActionIcon>
      )}
    </Group>
  );
}

const USER_COLORS = [
  '#e03131', '#1971c2', '#2f9e44', '#f08c00', '#9c36b5', '#0c8599',
  '#d6336c', '#5f3dc4', '#087f5b', '#e67700', '#1864ab', '#c2255c',
];

function colorFromUserId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return USER_COLORS[hash % USER_COLORS.length];
}

interface AwarenessUser {
  clientId: number;
  name: string;
  color: string;
}

function OnlineUsers({ provider }: { provider: WebsocketProvider }) {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    const refresh = () => {
      const next: AwarenessUser[] = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        const user = state?.user as { name?: string; color?: string } | undefined;
        if (user?.name) {
          next.push({ clientId, name: user.name, color: user.color ?? '#888888' });
        }
      });
      setUsers(next);
    };
    refresh();
    provider.awareness.on('change', refresh);
    provider.awareness.on('update', refresh);
    return () => {
      provider.awareness.off('change', refresh);
      provider.awareness.off('update', refresh);
    };
  }, [provider]);

  return (
    <Group gap={8} wrap="nowrap">
      <Text size="sm" c="dimmed">在线 {users.length}</Text>
      {users.map((user) => (
        <Group key={user.clientId} gap={4} wrap="nowrap">
          <Box w={8} h={8} style={{ borderRadius: '50%', background: user.color }} />
          <Text size="sm" c="dimmed">{user.name}</Text>
        </Group>
      ))}
    </Group>
  );
}

interface CollabEditorProps {
  docId: string;
  user: Pick<MeUser, 'id' | 'name'>;
  initialContent: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  editorRef: { current: Editor | null };
  onDirty: () => void;
}

/** 正文只由 Yjs 提供；连接状态变化不会走到这里重建 editor。 */
function CollabEditor({
  docId,
  user,
  initialContent,
  ydoc,
  provider,
  editorRef,
  onDirty,
}: CollabEditorProps) {
  const [focused, setFocused] = useState(false);
  const initialContentRef = useRef(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc, field: 'content' }),
      CollaborationCursor.configure({
        provider,
        user: { name: user.name, color: colorFromUserId(user.id) },
      }),
    ],
    editorProps: {
      attributes: { class: 'zcollab-editor', 'aria-label': '文档正文' },
    },
    onUpdate: onDirty,
  }, [ydoc, provider, docId]);

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
    };
  }, [editor, editorRef]);

  useEffect(() => {
    const syncFocus = () => setFocused(editor.isFocused);
    editor.on('focus', syncFocus);
    editor.on('blur', syncFocus);
    syncFocus();
    return () => {
      editor.off('focus', syncFocus);
      editor.off('blur', syncFocus);
    };
  }, [editor]);

  // 旧文档迁移：等同步后的 Yjs 更新安静下来再判断，避免把服务端快照认成空文档。
  useEffect(() => {
    let done = false;
    let timer: number | null = null;
    const scheduleMigration = () => {
      if (done) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (done) return;
        done = true;
        if (ydoc.getXmlFragment('content').length > 0) return;
        const raw = initialContentRef.current;
        if (!raw) return;
        editor
          .chain()
          .setContent(parseDocContent(raw), { emitUpdate: false })
          .command(({ tr }) => {
            tr.setMeta('addToHistory', false);
            return true;
          })
          .run();
      }, 120);
    };
    const onDocUpdate = () => scheduleMigration();
    const onSync = (synced: boolean) => {
      if (synced) scheduleMigration();
    };

    ydoc.on('update', onDocUpdate);
    provider.on('sync', onSync);
    if (provider.synced) scheduleMigration();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      ydoc.off('update', onDocUpdate);
      provider.off('sync', onSync);
    };
  }, [editor, provider, ydoc]);

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      canUndo: !!current?.can().undo(),
      canRedo: !!current?.can().redo(),
      bold: !!current?.isActive('bold'),
      italic: !!current?.isActive('italic'),
      strike: !!current?.isActive('strike'),
      h1: !!current?.isActive('heading', { level: 1 }),
      h2: !!current?.isActive('heading', { level: 2 }),
      h3: !!current?.isActive('heading', { level: 3 }),
      bulletList: !!current?.isActive('bulletList'),
      orderedList: !!current?.isActive('orderedList'),
      blockquote: !!current?.isActive('blockquote'),
      codeBlock: !!current?.isActive('codeBlock'),
      horizontalRule: !!current?.isActive('horizontalRule'),
    }),
  });

  const toolbarItems: {
    key: string;
    label: string;
    icon: ReactNode;
    active: boolean;
    unavailable?: boolean;
    action: () => void;
  }[] = [
    { key: 'undo', label: '撤销', icon: <UndoIcon />, active: false, unavailable: !toolbar?.canUndo, action: () => editor.chain().focus().undo().run() },
    { key: 'redo', label: '重做', icon: <RedoIcon />, active: false, unavailable: !toolbar?.canRedo, action: () => editor.chain().focus().redo().run() },
    { key: 'bold', label: '加粗', icon: <Glyph style={{ fontWeight: 700 }}>B</Glyph>, active: !!toolbar?.bold, action: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', label: '斜体', icon: <Glyph style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>I</Glyph>, active: !!toolbar?.italic, action: () => editor.chain().focus().toggleItalic().run() },
    { key: 'strike', label: '删除线', icon: <Glyph style={{ fontWeight: 600, textDecoration: 'line-through' }}>S</Glyph>, active: !!toolbar?.strike, action: () => editor.chain().focus().toggleStrike().run() },
    { key: 'h1', label: '一级标题', icon: <Glyph style={{ fontSize: 11, fontWeight: 700 }}>H1</Glyph>, active: !!toolbar?.h1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: 'h2', label: '二级标题', icon: <Glyph style={{ fontSize: 11, fontWeight: 700 }}>H2</Glyph>, active: !!toolbar?.h2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'h3', label: '三级标题', icon: <Glyph style={{ fontSize: 11, fontWeight: 700 }}>H3</Glyph>, active: !!toolbar?.h3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: 'bulletList', label: '无序列表', icon: <ListIcon ordered={false} />, active: !!toolbar?.bulletList, action: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'orderedList', label: '有序列表', icon: <ListIcon ordered />, active: !!toolbar?.orderedList, action: () => editor.chain().focus().toggleOrderedList().run() },
    { key: 'blockquote', label: '引用', icon: <Glyph style={{ fontSize: 18 }}>❝</Glyph>, active: !!toolbar?.blockquote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { key: 'codeBlock', label: '代码块', icon: <CodeIcon />, active: !!toolbar?.codeBlock, action: () => editor.chain().focus().toggleCodeBlock().run() },
    { key: 'horizontalRule', label: '分割线', icon: <RuleIcon />, active: false, action: () => editor.chain().focus().setHorizontalRule().run() },
  ];

  return (
    <Stack gap="xs">
      <Group gap={4} wrap="nowrap" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {toolbarItems.map((item) => (
          <ActionIcon
            key={item.key}
            size="compact-md"
            variant={item.active ? 'filled' : 'subtle'}
            color={item.active ? 'teal' : 'gray'}
            disabled={!focused || item.unavailable}
            title={item.label}
            aria-label={item.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={item.action}
          >
            {item.icon}
          </ActionIcon>
        ))}
      </Group>
      <EditorContent editor={editor} />
    </Stack>
  );
}

interface DocsPanelProps {
  workspaceId: string;
  user: Pick<MeUser, 'id' | 'name'>;
}

type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'failed';

const SAVE_LABELS: Record<SaveStatus, string> = {
  unsaved: '未保存',
  saving: '正在保存…',
  saved: '已保存',
  failed: '保存失败',
};

const SAVE_COLORS: Record<SaveStatus, string> = {
  unsaved: 'orange',
  saving: 'blue',
  saved: 'teal',
  failed: 'red',
};

const SAVE_DELAY = 1500;

const CONNECTION_LABELS: Record<CollabStatus, string> = {
  connecting: '协同连接中…',
  connected: '协同已连接',
  disconnected: '协同断开，重连中…',
};

const CONNECTION_COLORS: Record<CollabStatus, string> = {
  connecting: 'orange',
  connected: 'teal',
  disconnected: 'red',
};

export default function DocsPanel({ workspaceId, user }: DocsPanelProps) {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const { ydoc, provider, status } = useCollabDoc(selected?.id ?? null);

  const titleRef = useRef('');
  const editorRef = useRef<Editor | null>(null);
  const docIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const clearSaveTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const isCurrentDoc = useCallback(
    (id: string) => mountedRef.current && docIdRef.current === id,
    [],
  );

  const getPayload = useCallback(() => {
    const payload: { title: string; content?: string } = { title: titleRef.current };
    if (editorRef.current) {
      payload.content = JSON.stringify(editorRef.current.getJSON());
    }
    return payload;
  }, []);

  const performSave = useCallback((): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    if (!dirtyRef.current) return Promise.resolve();
    const docId = docIdRef.current;
    if (!docId) return Promise.resolve();

    dirtyRef.current = false;
    const payload = getPayload();
    setSaveStatus('saving');

    const request = updateDoc(docId, payload)
      .then((doc) => {
        if (!isCurrentDoc(docId)) return;
        setDocs((prev) => prev.map((item) => (item.id === doc.id ? { ...item, title: doc.title } : item)));
        setSaveStatus(dirtyRef.current ? (pendingRef.current ? 'saving' : 'unsaved') : 'saved');
      })
      .catch((error) => {
        if (!isCurrentDoc(docId)) return;
        notifyError(error);
        dirtyRef.current = true;
        setSaveStatus('failed');
      })
      .finally(() => {
        inFlightRef.current = null;
        const shouldRetry = pendingRef.current;
        pendingRef.current = false;
        if (shouldRetry && isCurrentDoc(docId) && dirtyRef.current) {
          void performSave();
        }
      });

    inFlightRef.current = request;
    return request;
  }, [getPayload, isCurrentDoc]);

  const flushNow = useCallback((): Promise<void> => {
    clearSaveTimer();
    if (!dirtyRef.current) return Promise.resolve();
    return performSave();
  }, [clearSaveTimer, performSave]);

  const markDirty = useCallback(() => {
    if (!docIdRef.current) return;
    dirtyRef.current = true;
    if (inFlightRef.current) {
      pendingRef.current = true;
      setSaveStatus('saving');
    } else {
      setSaveStatus('unsaved');
    }
    clearSaveTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushNow();
    }, SAVE_DELAY);
  }, [clearSaveTimer, flushNow]);

  const flushBeforeSwitch = useCallback(async () => {
    clearSaveTimer();
    if (inFlightRef.current) {
      while (inFlightRef.current) {
        await inFlightRef.current;
      }
      return;
    }
    if (dirtyRef.current) {
      await performSave();
      while (inFlightRef.current) {
        await inFlightRef.current;
      }
    }
  }, [clearSaveTimer, performSave]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSaveTimer();
    };
  }, [clearSaveTimer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (docIdRef.current) void flushNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flushNow]);

  useEffect(() => {
    let active = true;
    clearSaveTimer();
    docIdRef.current = null;
    titleRef.current = '';
    dirtyRef.current = false;
    pendingRef.current = false;
    setSelected(null);
    setTitle('');
    setSaveStatus('saved');
    setLoading(true);
    listDocs()
      .then((items) => {
        if (active) setDocs(items);
      })
      .catch((error) => {
        if (active) notifyError(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId, clearSaveTimer]);

  const tree = useMemo(() => buildTree(docs), [docs]);

  const openDoc = (doc: Doc) => {
    clearSaveTimer();
    docIdRef.current = doc.id;
    titleRef.current = doc.title;
    dirtyRef.current = false;
    pendingRef.current = false;
    setSelected(doc);
    setTitle(doc.title);
    setSaveStatus('saved');
  };

  const selectDoc = (id: string) => {
    setBusy(true);
    void flushBeforeSwitch()
      .then(() => getDoc(id))
      .then(openDoc)
      .catch(notifyError)
      .finally(() => setBusy(false));
  };

  const handleCreate = () => {
    setBusy(true);
    void flushBeforeSwitch()
      .then(() => createDoc(selected?.id))
      .then((doc) => {
        setDocs((prev) => [...prev, { id: doc.id, parentDocId: doc.parentDocId, title: doc.title }]);
        openDoc(doc);
      })
      .catch(notifyError)
      .finally(() => setBusy(false));
  };

  const handleDelete = (id: string, docTitle: string) => {
    if (!window.confirm(`确定删除「${docTitle || '无标题'}」及其所有子文档吗？`)) return;
    if (id === docIdRef.current) {
      clearSaveTimer();
      dirtyRef.current = false;
      pendingRef.current = false;
      docIdRef.current = null;
    }
    setBusy(true);
    deleteDoc(id)
      .then(() => {
        const removed = collectRemoved(docs, id);
        setDocs((prev) => prev.filter((item) => !removed.has(item.id)));
        if (selected && removed.has(selected.id)) {
          setSelected(null);
          setTitle('');
          titleRef.current = '';
          setSaveStatus('saved');
        }
        notifications.show({ color: 'green', title: '已删除', message: '' });
      })
      .catch(notifyError)
      .finally(() => setBusy(false));
  };

  const renderNode = (node: TreeNode, depth: number) => (
    <Stack key={node.id} gap={0}>
      <NodeRow
        node={node}
        depth={depth}
        selectedId={selected?.id ?? null}
        onSelect={selectDoc}
        onDelete={handleDelete}
      />
      {node.children.map((child) => renderNode(child, depth + 1))}
    </Stack>
  );

  return (
    <Paper shadow="sm" radius="lg" withBorder style={{ overflow: 'hidden' }}>
      <style>{editorStyles}</style>
      <Group align="stretch" gap={0} wrap="nowrap">
        <Box
          w={260}
          flex="0 0 260px"
          p="sm"
          style={{ borderRight: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Button fullWidth size="compact-sm" loading={busy} onClick={handleCreate} mb="sm">
            新建文档
          </Button>
          {loading ? (
            <Center py="xl"><Loader color="teal" size="sm" /></Center>
          ) : tree.length ? (
            <Stack gap={2}>{tree.map((node) => renderNode(node, 0))}</Stack>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="xl">还没有文档</Text>
          )}
        </Box>

        <Box flex={1} p="lg" style={{ minHeight: 520 }}>
          {selected ? (
            <Stack gap="md" h="100%">
              <Group justify="flex-end" gap="md" wrap="nowrap">
                {provider && <OnlineUsers provider={provider} />}
                <Text size="sm" c={CONNECTION_COLORS[status]}>{CONNECTION_LABELS[status]}</Text>
                <Text size="sm" c={SAVE_COLORS[saveStatus]}>{SAVE_LABELS[saveStatus]}</Text>
              </Group>
              <TextInput
                variant="unstyled"
                aria-label="文档标题"
                placeholder="无标题"
                value={title}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  titleRef.current = value;
                  setTitle(value);
                  markDirty();
                }}
                styles={{ input: { fontSize: 30, fontWeight: 600, padding: 0 } }}
              />
              {ydoc && provider ? (
                <CollabEditor
                  key={selected.id}
                  docId={selected.id}
                  user={user}
                  initialContent={selected.content}
                  ydoc={ydoc}
                  provider={provider}
                  editorRef={editorRef}
                  onDirty={markDirty}
                />
              ) : (
                <Center py={80}><Loader color="teal" size="sm" /></Center>
              )}
            </Stack>
          ) : (
            <Center h="100%" mih={460}>
              <Text c="dimmed">从左侧选一篇，或新建一篇</Text>
            </Center>
          )}
        </Box>
      </Group>
    </Paper>
  );
}
