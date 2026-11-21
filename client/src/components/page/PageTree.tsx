import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { ActionIcon, Menu, Text, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconChevronRight,
  IconDots,
  IconFileText,
  IconLink,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { updateDoc, type DocSummary } from '../../api/doc';
import { useWorkspace } from '../../context/WorkspaceContext';
import { buildTree, getDocPath, type TreeNode } from '../../lib/docTree';
import classes from './PageTree.module.css';

interface PageTreeProps {
  docs: DocSummary[];
  currentDocId?: string;
  loading?: boolean;
  collapseAllSignal?: number;
  onSelect: (docId: string) => void;
  onDelete: (docId: string, title: string) => void;
}

interface VisibleRow {
  node: TreeNode;
  depth: number;
  parentId?: string;
}

interface MenuState {
  docId: string;
  x: number;
  y: number;
}

const EXPANDED_KEY_PREFIX = 'zc:tree-expanded:';

function readExpanded(workspaceId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${EXPANDED_KEY_PREFIX}${workspaceId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function writeExpanded(workspaceId: string, ids: string[]): void {
  try {
    window.localStorage.setItem(`${EXPANDED_KEY_PREFIX}${workspaceId}`, JSON.stringify(ids));
  } catch {
    // 存储不可用时只保留内存状态
  }
}

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

export default function PageTree({
  docs,
  currentDocId,
  loading,
  collapseAllSignal = 0,
  onSelect,
  onDelete,
}: PageTreeProps) {
  const { workspaceId, setDocs, create } = useWorkspace();
  const [expandedMap, setExpandedMap] = useState<Record<string, string[]>>(() => ({
    [workspaceId]: readExpanded(workspaceId),
  }));
  const expanded = expandedMap[workspaceId] ?? readExpanded(workspaceId);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameCommittedRef = useRef(false);

  const updateExpanded = useCallback((update: (ids: string[]) => string[]) => {
    setExpandedMap((prev) => ({
      ...prev,
      [workspaceId]: update(prev[workspaceId] ?? readExpanded(workspaceId)),
    }));
  }, [workspaceId]);

  const toggleExpanded = useCallback((id: string) => {
    updateExpanded((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }, [updateExpanded]);

  useEffect(() => {
    const ids = expandedMap[workspaceId];
    if (ids) writeExpanded(workspaceId, ids);
  }, [expandedMap, workspaceId]);

  useEffect(() => {
    if (!currentDocId) return;
    const ancestors = getDocPath(docs, currentDocId).slice(0, -1).map((doc) => doc.id);
    if (!ancestors.length) return;
    updateExpanded((ids) => {
      const next = [...ids];
      let changed = false;
      for (const id of ancestors) {
        if (!next.includes(id)) {
          next.push(id);
          changed = true;
        }
      }
      return changed ? next : ids;
    });
  }, [currentDocId, docs, updateExpanded]);

  useEffect(() => {
    if (!collapseAllSignal) return;
    updateExpanded(() => []);
  }, [collapseAllSignal, updateExpanded]);

  useEffect(() => {
    if (!renamingId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingId]);

  const tree = useMemo(() => buildTree(docs), [docs]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);

  const visibleRows = useMemo(() => {
    const rows: VisibleRow[] = [];
    const walk = (node: TreeNode, depth: number, parentId?: string) => {
      rows.push({ node, depth, parentId });
      if (node.children.length && expandedSet.has(node.id)) {
        node.children.forEach((child) => walk(child, depth + 1, node.id));
      }
    };
    tree.forEach((node) => walk(node, 0));
    return rows;
  }, [tree, expandedSet]);

  const focusRow = useCallback((id: string) => {
    window.requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
  }, []);

  const startRename = useCallback((doc: DocSummary) => {
    renameCommittedRef.current = false;
    setRenameValue(doc.title);
    setRenamingId(doc.id);
    setMenuState(null);
  }, []);

  const cancelRename = useCallback(() => {
    renameCommittedRef.current = true;
    setRenamingId(null);
  }, []);

  const commitRename = useCallback(async (id: string) => {
    if (renameCommittedRef.current) return;
    renameCommittedRef.current = true;
    const title = renameValue.trim();
    setRenamingId(null);
    try {
      const updated = await updateDoc(id, { title });
      setDocs((prev) => prev.map((doc) => (
        doc.id === updated.id ? { ...doc, title: updated.title } : doc
      )));
    } catch (error) {
      notifyError(error);
    }
  }, [renameValue, setDocs]);

  const copyLink = useCallback(async (id: string) => {
    const link = `${window.location.origin}/w/${workspaceId}/p/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      notifications.show({ color: 'green', title: '链接已复制', message: link });
    } catch (error) {
      notifyError(error);
    }
  }, [workspaceId]);

  const createChild = useCallback(async (parentId: string) => {
    if (creatingId) return;
    setCreatingId(parentId);
    setMenuState(null);
    try {
      const doc = await create(parentId);
      updateExpanded((ids) => (ids.includes(parentId) ? ids : [...ids, parentId]));
      onSelect(doc.id);
    } catch (error) {
      notifyError(error);
    } finally {
      setCreatingId(null);
    }
  }, [create, creatingId, onSelect, updateExpanded]);

  const handleRowKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
    node: TreeNode,
    parentId: string | undefined,
    hasChildren: boolean,
    isExpanded: boolean,
  ) => {
    if (renamingId === node.id) return;
    const index = visibleRows.findIndex((row) => row.node.id === node.id);

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        onSelect(node.id);
        break;
      case ' ':
        event.preventDefault();
        if (hasChildren) toggleExpanded(node.id);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (!hasChildren) break;
        if (!isExpanded) toggleExpanded(node.id);
        focusRow(node.children[0].id);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (hasChildren && isExpanded) {
          toggleExpanded(node.id);
        } else if (parentId) {
          focusRow(parentId);
        }
        break;
      case 'ArrowDown': {
        event.preventDefault();
        const next = visibleRows[index + 1];
        if (next) focusRow(next.node.id);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const previous = visibleRows[index - 1];
        if (previous) focusRow(previous.node.id);
        break;
      }
      default:
        break;
    }
  }, [focusRow, onSelect, renamingId, toggleExpanded, visibleRows]);

  const renderRow = ({ node, depth, parentId }: VisibleRow) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedSet.has(node.id);
    const isCurrent = node.id === currentDocId;
    const isMenuTarget = menuState?.docId === node.id;
    const isRenaming = renamingId === node.id;

    return (
      <div
        key={node.id}
        ref={(element) => {
          if (element) rowRefs.current.set(node.id, element);
          else rowRefs.current.delete(node.id);
        }}
        role="treeitem"
        aria-selected={isCurrent || isMenuTarget}
        aria-expanded={hasChildren ? isExpanded : false}
        tabIndex={0}
        className={`${classes.row} ${isCurrent ? classes.selected : ''} ${isMenuTarget ? classes.contextActive : ''}`}
        style={{ '--indent': `${depth * 12}px` } as CSSProperties}
        onClick={() => {
          if (!isRenaming) onSelect(node.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMenuState({ docId: node.id, x: event.clientX, y: event.clientY });
          rowRefs.current.get(node.id)?.focus();
        }}
        onKeyDown={(event) => handleRowKeyDown(event, node, parentId, hasChildren, isExpanded)}
      >
        {hasChildren ? (
          <button
            type="button"
            className={classes.chevron}
            aria-label={isExpanded ? '折叠' : '展开'}
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded(node.id);
            }}
          >
            <IconChevronRight
              size={14}
              stroke={1.7}
              className={isExpanded ? classes.chevronOpen : undefined}
            />
          </button>
        ) : (
          <span className={classes.chevronPlaceholder} aria-hidden="true" />
        )}
        <span className={classes.icon}><IconFileText size={14} stroke={1.7} /></span>
        {isRenaming ? (
          <TextInput
            ref={(input) => { renameInputRef.current = input; }}
            size="xs"
            variant="filled"
            value={renameValue}
            autoFocus
            aria-label={`重命名 ${node.title || '无标题'}`}
            className={classes.rename}
            classNames={{ input: classes.renameInput }}
            onClick={(event) => event.stopPropagation()}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setRenameValue(event.currentTarget.value)}
            onBlur={() => void commitRename(node.id)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                event.preventDefault();
                void commitRename(node.id);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
          />
        ) : (
          <span className={classes.title}>{node.title || '无标题'}</span>
        )}
        {!isRenaming && (
          <span className={classes.actions}>
            <Tooltip label="新建子页面" withArrow>
              <ActionIcon
                size="compact-xs"
                variant="subtle"
                aria-label="新建子页面"
                loading={creatingId === node.id}
                onClick={(event) => {
                  event.stopPropagation();
                  void createChild(node.id);
                }}
              >
                <IconPlus size={13} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="更多操作" withArrow>
              <ActionIcon
                size="compact-xs"
                variant="subtle"
                aria-label="更多操作"
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setMenuState({ docId: node.id, x: rect.left, y: rect.bottom + 4 });
                }}
              >
                <IconDots size={13} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          </span>
        )}
      </div>
    );
  };

  const menuDoc = menuState ? docs.find((doc) => doc.id === menuState.docId) : undefined;

  return (
    <>
      {loading ? (
        <Text className={classes.empty} size="xs">正在加载文档…</Text>
      ) : !tree.length ? (
        <Text className={classes.empty} size="xs">还没有文档</Text>
      ) : (
        <div role="tree" className={classes.tree}>
          {visibleRows.map(renderRow)}
        </div>
      )}

      <Menu
        opened={Boolean(menuState)}
        onClose={() => setMenuState(null)}
        position="bottom-start"
        width={180}
        shadow="md"
      >
        <Menu.Target>
          <span
            aria-hidden="true"
            className={classes.menuAnchor}
            style={{ left: menuState?.x ?? 0, top: menuState?.y ?? 0 }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{menuDoc?.title || '无标题'}</Menu.Label>
          <Menu.Item
            leftSection={<IconPencil size={15} stroke={1.7} />}
            disabled={!menuDoc}
            onClick={() => menuDoc && startRename(menuDoc)}
          >
            重命名
          </Menu.Item>
          <Menu.Item
            leftSection={<IconLink size={15} stroke={1.7} />}
            disabled={!menuDoc}
            onClick={() => {
              if (menuDoc) void copyLink(menuDoc.id);
            }}
          >
            复制链接
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={15} stroke={1.7} />}
            disabled={!menuDoc}
            onClick={() => {
              if (!menuDoc) return;
              setMenuState(null);
              onDelete(menuDoc.id, menuDoc.title);
            }}
          >
            删除
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
