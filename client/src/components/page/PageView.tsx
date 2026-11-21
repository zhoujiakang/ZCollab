import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionIcon, Center, Loader, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import { CollaborationCaret as CollaborationCursor } from '@tiptap/extension-collaboration-caret';
import type { WebsocketProvider } from 'y-websocket';
import type * as Y from 'yjs';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBlockquote,
  IconBold,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconItalic,
  IconList,
  IconListNumbers,
  IconMinus,
  IconShare3,
  IconStar,
  IconStarFilled,
  IconStrikethrough,
  IconTrash,
} from '@tabler/icons-react';
import { claimSeedDoc, getDoc, updateDoc, visitDoc, type Doc } from '../../api/doc';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useCollabDoc, type CollabStatus } from '../../collab/useCollabDoc';
import { hasDocContent, parseDocContent } from '../../lib/docContent';
import { getDocPath } from '../../lib/docTree';
import { useAside, type AsideHeading } from '../layout/AsideContext';
import ShareDialog from '../ShareDialog';
import editorClasses from './Editor.module.css';
import classes from './PageView.module.css';

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
const OUTLINE_TOP_OFFSET = 110;

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

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
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

interface OutlineState {
  headings: AsideHeading[];
  chars: number;
  charsWithSpace: number;
  paragraphs: number;
}

function useAwarenessUsers(provider: WebsocketProvider): AwarenessUser[] {
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

  return users;
}

/** 在线人数只在人数变化时更新，避免光标 awareness 更新引起正文重渲染。 */
function useAwarenessCount(provider: WebsocketProvider | null): number {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    if (!provider) {
      countRef.current = 0;
      setCount(0);
      return;
    }
    const refresh = () => {
      let next = 0;
      provider.awareness.getStates().forEach((state) => {
        const user = state?.user as { name?: string } | undefined;
        if (user?.name) next += 1;
      });
      if (next === countRef.current) return;
      countRef.current = next;
      queueMicrotask(() => setCount(next));
    };
    refresh();
    provider.awareness.on('change', refresh);
    provider.awareness.on('update', refresh);
    return () => {
      provider.awareness.off('change', refresh);
      provider.awareness.off('update', refresh);
      countRef.current = 0;
      setCount(0);
    };
  }, [provider]);

  return count;
}

function OnlineUsers({ provider }: { provider: WebsocketProvider }) {
  const users = useAwarenessUsers(provider);
  return (
    <span className={classes.onlineUsers}>
      <Text size="sm" c="dimmed">在线 {users.length}</Text>
      {users.map((user) => (
        <span key={user.clientId} className={classes.onlineUser}>
          <span
            className={classes.onlineDot}
            style={{ '--dot-color': user.color } as CSSProperties}
          />
          <Text size="sm" c="dimmed">{user.name}</Text>
        </span>
      ))}
    </span>
  );
}

interface CollabEditorProps {
  docId: string;
  user: { id: string; name: string };
  initialContent: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  editorRef: { current: Editor | null };
  onDirty: () => void;
  onReady: () => void;
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
  onReady,
}: CollabEditorProps) {
  const initialContentRef = useRef(initialContent);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

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

  // 旧文档迁移：只有服务端原子认领成功的一端负责把 doc.content 灌进 Yjs。
  const [waitingForSeed, setWaitingForSeed] = useState(false);
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    const fragment = ydoc.getXmlFragment('content');

    const clearWaiting = () => {
      if (waitTimer !== undefined) {
        clearTimeout(waitTimer);
        waitTimer = undefined;
      }
      if (!cancelled) setWaitingForSeed(false);
    };
    const notifyReady = () => {
      // Yjs 观察回调可能发生在渲染期间，延后通知上层避免跨组件 setState。
      window.setTimeout(() => {
        if (!cancelled) onReadyRef.current();
      }, 0);
    };
    const onFragmentChange = () => {
      if (fragment.length > 0) {
        window.setTimeout(() => {
          if (!cancelled) {
            clearWaiting();
            onReadyRef.current();
          }
        }, 0);
      }
    };
    fragment.observeDeep(onFragmentChange);

    const migrateOnce = async (synced: boolean) => {
      if (!synced || migrationDoneRef.current) return;
      migrationDoneRef.current = true;
      if (fragment.length !== 0) {
        notifyReady();
        return;
      }
      const raw = initialContentRef.current;
      if (!raw) {
        notifyReady();
        return;
      }
      const parsed = parseDocContent(raw);
      if (!hasDocContent(parsed)) {
        notifyReady();
        return;
      }

      let seeded = false;
      try {
        seeded = await claimSeedDoc(docId);
      } catch {
        seeded = false;
      }
      if (cancelled) return;

      if (!seeded) {
        setWaitingForSeed(true);
        if (fragment.length > 0) {
          clearWaiting();
          notifyReady();
          return;
        }
        waitTimer = setTimeout(() => {
          waitTimer = undefined;
          if (!cancelled) setWaitingForSeed(false);
        }, 5000);
        return;
      }
      if (fragment.length !== 0) {
        notifyReady();
        return;
      }

      editor
        .chain()
        .setContent(parsed, { emitUpdate: false })
        .command(({ tr }) => {
          tr.setMeta('addToHistory', false);
          return true;
        })
        .run();
      notifyReady();
    };
    const onSync = (synced: boolean) => void migrateOnce(synced);

    provider.on('sync', onSync);
    if (provider.synced) void migrateOnce(true);
    return () => {
      cancelled = true;
      if (waitTimer !== undefined) clearTimeout(waitTimer);
      fragment.unobserveDeep(onFragmentChange);
      provider.off('sync', onSync);
    };
  }, [docId, editor, provider, ydoc]);

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
    }),
  });

  const toolbarItems = [
    { key: 'undo', label: '撤销', icon: <IconArrowBackUp size={16} stroke={1.7} />, active: false, unavailable: !toolbar?.canUndo, action: () => editor.chain().focus().undo().run() },
    { key: 'redo', label: '重做', icon: <IconArrowForwardUp size={16} stroke={1.7} />, active: false, unavailable: !toolbar?.canRedo, action: () => editor.chain().focus().redo().run() },
    { key: 'bold', label: '加粗', icon: <IconBold size={16} stroke={1.7} />, active: !!toolbar?.bold, action: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', label: '斜体', icon: <IconItalic size={16} stroke={1.7} />, active: !!toolbar?.italic, action: () => editor.chain().focus().toggleItalic().run() },
    { key: 'strike', label: '删除线', icon: <IconStrikethrough size={16} stroke={1.7} />, active: !!toolbar?.strike, action: () => editor.chain().focus().toggleStrike().run() },
    { key: 'h1', label: '一级标题', icon: <IconH1 size={16} stroke={1.7} />, active: !!toolbar?.h1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: 'h2', label: '二级标题', icon: <IconH2 size={16} stroke={1.7} />, active: !!toolbar?.h2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'h3', label: '三级标题', icon: <IconH3 size={16} stroke={1.7} />, active: !!toolbar?.h3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: 'bulletList', label: '无序列表', icon: <IconList size={16} stroke={1.7} />, active: !!toolbar?.bulletList, action: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'orderedList', label: '有序列表', icon: <IconListNumbers size={16} stroke={1.7} />, active: !!toolbar?.orderedList, action: () => editor.chain().focus().toggleOrderedList().run() },
    { key: 'blockquote', label: '引用', icon: <IconBlockquote size={16} stroke={1.7} />, active: !!toolbar?.blockquote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { key: 'codeBlock', label: '代码块', icon: <IconCode size={16} stroke={1.7} />, active: !!toolbar?.codeBlock, action: () => editor.chain().focus().toggleCodeBlock().run() },
    { key: 'horizontalRule', label: '分割线', icon: <IconMinus size={16} stroke={1.7} />, active: false, action: () => editor.chain().focus().setHorizontalRule().run() },
  ];

  return (
    <>
      <div className={classes.toolbar}>
        {toolbarItems.map((item) => (
          <ActionIcon
            key={item.key}
            size="compact-md"
            variant={item.active ? 'filled' : 'subtle'}
            color={item.active ? 'blue' : 'gray'}
            disabled={item.unavailable}
            title={item.label}
            aria-label={item.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={item.action}
          >
            {item.icon}
          </ActionIcon>
        ))}
      </div>
      {waitingForSeed && <Text className={classes.loadingNote}>正在同步内容</Text>}
      <EditorContent editor={editor} />
    </>
  );
}

export default function PageView() {
  const { workspaceId, docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    docs, setDocs, remove, registerFlush, favoriteIds, toggleFavorite, refreshRecent,
  } = useWorkspace();
  const workspace = workspaceId!;

  const [selected, setSelected] = useState<Doc | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastEditedAt, setLastEditedAt] = useState(() => new Date());
  const [shareOpened, setShareOpened] = useState(false);

  const { ydoc, provider, status } = useCollabDoc(docId ?? null);
  const { publish } = useAside();
  const online = useAwarenessCount(provider);

  const [outline, setOutline] = useState<OutlineState>({ headings: [], chars: 0, charsWithSpace: 0, paragraphs: 0 });
  const [editorRevision, setEditorRevision] = useState(0);
  const [editorReady, setEditorReady] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const titleRef = useRef('');
  const editorRef = useRef<Editor | null>(null);
  const docIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const needsIndexRef = useRef(false);

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
    const payload: { title: string; content?: string; text?: string } = { title: titleRef.current };
    if (editorRef.current) {
      payload.content = JSON.stringify(editorRef.current.getJSON());
      payload.text = editorRef.current.getText();
    }
    return payload;
  }, []);

  const performSave = useCallback((): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    if (!dirtyRef.current) return Promise.resolve();
    const id = docIdRef.current;
    if (!id) return Promise.resolve();

    dirtyRef.current = false;
    const payload = getPayload();
    setSaveStatus('saving');

    const request = updateDoc(id, payload)
      .then((doc) => {
        if (!isCurrentDoc(id)) return;
        setDocs((prev) => prev.map((item) => (item.id === doc.id ? { ...item, title: doc.title } : item)));
        setSelected((prev) => (prev && prev.id === doc.id ? { ...prev, ...doc } : prev));
        setSaveStatus(dirtyRef.current ? (pendingRef.current ? 'saving' : 'unsaved') : 'saved');
      })
      .catch((error) => {
        if (!isCurrentDoc(id)) return;
        notifyError(error);
        dirtyRef.current = true;
        setSaveStatus('failed');
      })
      .finally(() => {
        inFlightRef.current = null;
        const shouldRetry = pendingRef.current;
        pendingRef.current = false;
        if (shouldRetry && isCurrentDoc(id) && dirtyRef.current) {
          void performSave();
        }
      });

    inFlightRef.current = request;
    return request;
  }, [getPayload, isCurrentDoc, setDocs]);

  const flushNow = useCallback((): Promise<void> => {
    clearSaveTimer();
    if (!dirtyRef.current) return Promise.resolve();
    return performSave();
  }, [clearSaveTimer, performSave]);

  const markDirty = useCallback(() => {
    if (!docIdRef.current) return;
    dirtyRef.current = true;
    const nextStatus: SaveStatus = inFlightRef.current ? 'saving' : 'unsaved';
    if (inFlightRef.current) pendingRef.current = true;
    clearSaveTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushNow();
    }, SAVE_DELAY);
    // Tiptap/Yjs 可能在 CollabEditor 渲染期间派发 onUpdate，延后通知上层避免跨组件 setState。
    queueMicrotask(() => {
      if (!mountedRef.current) return;
      setLastEditedAt(new Date());
      setEditorRevision((value) => value + 1);
      setSaveStatus(nextStatus);
    });
  }, [clearSaveTimer, flushNow]);

  const handleEditorReady = useCallback(() => {
    setEditorReady(true);
    setEditorRevision((value) => value + 1);
    if (!needsIndexRef.current) return;
    needsIndexRef.current = false;
    markDirty();
  }, [markDirty]);

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

  const openDoc = useCallback((doc: Doc) => {
    clearSaveTimer();
    docIdRef.current = doc.id;
    titleRef.current = doc.title;
    dirtyRef.current = false;
    pendingRef.current = false;
    needsIndexRef.current = Boolean(!doc.contentText && doc.content);
    setSelected(doc);
    setTitle(doc.title);
    setSaveStatus('saved');
    setLastEditedAt(doc.updatedAt ? new Date(doc.updatedAt) : new Date());
    setOutline({ headings: [], chars: 0, charsWithSpace: 0, paragraphs: 0 });
    setActiveHeadingId(null);
    setEditorReady(false);
    publish(null);
  }, [clearSaveTimer, publish]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSaveTimer();
    };
  }, [clearSaveTimer]);

  useEffect(() => {
    registerFlush(flushBeforeSwitch);
    return () => registerFlush(null);
  }, [registerFlush, flushBeforeSwitch]);

  useEffect(() => () => {
    clearSaveTimer();
    if (dirtyRef.current) void performSave();
  }, [clearSaveTimer, performSave]);

  useEffect(() => {
    if (!docId) {
      setSelected(null);
      setTitle('');
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        await flushBeforeSwitch();
        if (!active) return;
        docIdRef.current = null;
        titleRef.current = '';
        dirtyRef.current = false;
        pendingRef.current = false;
        needsIndexRef.current = false;
        const doc = await getDoc(docId);
        if (!active) return;
        openDoc(doc);
        void visitDoc(doc.id)
          .then(() => {
            if (active) return refreshRecent();
          })
          .catch((error) => {
            console.error('记录最近打开失败', error);
          });
      } catch (error) {
        if (active) {
          notifyError(error);
          setSelected(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [docId, flushBeforeSwitch, openDoc, refreshRecent]);

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

  useEffect(() => () => publish(null), [publish]);

  // 目录与统计一律从编辑器当前状态采集，协同修改也会重新计算。
  useEffect(() => {
    const current = editorRef.current;
    if (!editorReady || !current) return;
    const headings: AsideHeading[] = [];
    current.state.doc.descendants((node) => {
      if (node.type.name === 'heading') {
        headings.push({
          id: `h${headings.length}`,
          level: Number(node.attrs.level) || 1,
          text: node.textContent || '无标题',
        });
      }
    });
    const text = current.getText();
    setOutline({
      headings,
      chars: text.replace(/\s/g, '').length,
      charsWithSpace: text.length,
      paragraphs: text.split(/\n\s*\n/).filter((part) => part.trim().length > 0).length,
    });
  }, [editorReady, editorRevision]);

  useEffect(() => {
    const current = editorRef.current;
    if (!editorReady || !current) return;
    const elements = Array.from(current.view.dom.querySelectorAll<HTMLElement>('h1, h2, h3'));
    if (!elements.length) {
      setActiveHeadingId(null);
      return;
    }
    const refreshActive = () => {
      let index = 0;
      elements.forEach((element, i) => {
        if (element.getBoundingClientRect().top <= OUTLINE_TOP_OFFSET) index = i;
      });
      setActiveHeadingId(`h${index}`);
    };
    const observer = new IntersectionObserver(refreshActive, {
      root: null,
      rootMargin: `-${OUTLINE_TOP_OFFSET}px 0px -70% 0px`,
      threshold: 0,
    });
    elements.forEach((element) => observer.observe(element));
    refreshActive();
    return () => observer.disconnect();
  }, [editorReady, editorRevision, outline.headings.length]);

  const onJump = useCallback((id: string) => {
    const current = editorRef.current;
    if (!current) return;
    const index = Number(id.slice(1));
    if (!Number.isInteger(index) || index < 0) return;
    const target = current.view.dom.querySelectorAll<HTMLElement>('h1, h2, h3')[index];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.setAttribute('data-outline-active', '');
    window.setTimeout(() => target.removeAttribute('data-outline-active'), 300);
  }, []);

  useEffect(() => {
    if (!editorReady || !selected || !docId) return;
    publish({
      title: title || '无标题',
      updatedAt: selected.updatedAt,
      headings: outline.headings,
      activeHeadingId,
      meta: {
        chars: outline.chars,
        charsWithSpace: outline.charsWithSpace,
        paragraphs: outline.paragraphs,
        online,
      },
      onJump,
    });
  }, [editorReady, selected, docId, title, outline, activeHeadingId, online, onJump, publish]);

  const path = useMemo(() => getDocPath(docs, docId), [docs, docId]);
  const isFavorite = Boolean(selected && favoriteIds.has(selected.id));
  const crumbs = path.length
    ? path
    : docId
      ? [{ id: docId, parentDocId: null, title: selected?.title || '无标题' }]
      : [];

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`确定删除「${selected.title || '无标题'}」及其所有子文档吗？`)) return;
    try {
      const parentId = path.length > 1 ? path[path.length - 2].id : null;
      await remove(selected.id);
      navigate(parentId ? `/w/${workspace}/p/${parentId}` : `/w/${workspace}`);
      notifications.show({ color: 'green', title: '已删除', message: '' });
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <div className={classes.pageHeader}>
        <div className={classes.breadcrumb}>
          <button type="button" className={classes.crumb} onClick={() => navigate(`/w/${workspace}`)}>
            {user?.activeWorkspace?.name || '工作区'}
          </button>
          {crumbs.map((crumb, index) => (
            <span key={crumb.id} className={classes.breadcrumb}>
              <span className={classes.separator}>/</span>
              {index === crumbs.length - 1 ? (
                <span className={classes.crumbCurrent}>{crumb.title || '无标题'}</span>
              ) : (
                <button type="button" className={classes.crumb} onClick={() => navigate(`/w/${workspace}/p/${crumb.id}`)}>
                  {crumb.title || '无标题'}
                </button>
              )}
            </span>
          ))}
        </div>
        <div className={classes.headerRight}>
          <Text className={classes.status} c={CONNECTION_COLORS[status]}>{CONNECTION_LABELS[status]}</Text>
          <Text className={classes.status} c={SAVE_COLORS[saveStatus]}>{SAVE_LABELS[saveStatus]}</Text>
          <Tooltip label={isFavorite ? '取消收藏' : '收藏'} withArrow>
            <span>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={isFavorite ? '取消收藏' : '收藏'}
                disabled={!selected}
                onClick={() => {
                  if (selected) void toggleFavorite(selected.id).catch(() => undefined);
                }}
              >
                {isFavorite ? (
                  <IconStarFilled size={18} stroke={1.7} style={{ color: 'var(--mantine-primary-color-filled)' }} />
                ) : (
                  <IconStar size={18} stroke={1.7} />
                )}
              </ActionIcon>
            </span>
          </Tooltip>
          <Tooltip label="分享" withArrow>
            <span>
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label="分享"
                disabled={!selected}
                onClick={() => setShareOpened(true)}
              >
                <IconShare3 size={18} stroke={1.7} />
              </ActionIcon>
            </span>
          </Tooltip>
          <Tooltip label="删除" withArrow>
            <span>
              <ActionIcon variant="subtle" size="sm" color="red" aria-label="删除" disabled={!selected} onClick={() => void handleDelete()}>
                <IconTrash size={18} stroke={1.7} />
              </ActionIcon>
            </span>
          </Tooltip>
        </div>
      </div>

      <div className={`${classes.container} ${editorClasses.editor}`}>
        {loading ? (
          <Center py={100}><Loader size="sm" /></Center>
        ) : !selected || !docId ? (
          <Center py={100}>
            <Text c="dimmed">从左侧选一篇，或新建一篇</Text>
          </Center>
        ) : (
          <>
            <input
              className={classes.titleInput}
              aria-label="文档标题"
              placeholder="无标题"
              value={title}
              onChange={(event) => {
                const value = event.currentTarget.value;
                titleRef.current = value;
                setTitle(value);
                markDirty();
              }}
            />
            <div className={classes.metaRow}>
              <span>最后编辑时间：{formatTime(lastEditedAt)}</span>
              {provider && <OnlineUsers provider={provider} />}
            </div>
            {ydoc && provider ? (
              <CollabEditor
                key={selected.id}
                docId={selected.id}
                user={{ id: user!.id, name: user!.name }}
                initialContent={selected.content}
                ydoc={ydoc}
                provider={provider}
                editorRef={editorRef}
                onDirty={markDirty}
                onReady={handleEditorReady}
              />
            ) : (
              <Center py={80}><Loader size="sm" /></Center>
            )}
          </>
        )}
      </div>

      {selected && (
        <ShareDialog opened={shareOpened} onClose={() => setShareOpened(false)} docId={selected.id} />
      )}
    </>
  );
}
