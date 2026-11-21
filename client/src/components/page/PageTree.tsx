import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ActionIcon, Menu, Text, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowsMove,
  IconChevronRight,
  IconDots,
  IconFileText,
  IconLink,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import {
  moveDoc,
  updateDoc,
  type DocSummary,
  type MoveDocInput,
} from '../../api/doc';
import { useWorkspace } from '../../context/WorkspaceContext';
import { buildTree, collectRemoved, getDocPath, type TreeNode } from '../../lib/docTree';
import MoveDocDialog from './MoveDocDialog';
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
  id: string;
  parentDocId: string | null;
  depth: number;
  hasChildren: boolean;
}

interface MenuState {
  docId: string;
  x: number;
  y: number;
}

interface RowDndData {
  id: string;
  parentDocId: string | null;
  depth: number;
  hasChildren: boolean;
}

type DropPosition = 'before' | 'after' | 'inside';

interface DropTarget {
  id: string;
  position: DropPosition;
}

interface DndRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  row: VisibleRow;
  dropPosition: DropPosition | null;
  registerRow: (id: string, element: HTMLDivElement | null) => void;
  styles: Record<string, string>;
}

interface BlankDropZoneProps {
  styles: Record<string, string>;
  active: boolean;
}

const EXPANDED_KEY_PREFIX = 'zc:tree-expanded:';
const DRAG_PREFIX = 'drag:';
const DROP_PREFIX = 'drop:';
const BLANK_DROP_ID = 'tree:blank';

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

function isRowDndData(value: unknown): value is RowDndData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RowDndData>;
  return typeof data.id === 'string'
    && (data.parentDocId === null || typeof data.parentDocId === 'string')
    && typeof data.depth === 'number'
    && typeof data.hasChildren === 'boolean';
}

function getActiveId(data: unknown): string | null {
  return isRowDndData(data) ? data.id : null;
}

function getPointerRatio(
  event: DragOverEvent | DragEndEvent,
  rect: { top: number; height: number },
): number | null {
  const activator = event.activatorEvent as PointerEvent;
  if (typeof activator.clientY !== 'number' || rect.height <= 0) return null;
  return (activator.clientY + event.delta.y - rect.top) / rect.height;
}

function getNextSiblingId(docs: DocSummary[], id: string): string | null {
  const target = docs.find((doc) => doc.id === id);
  if (!target) return null;
  const parentDocId = target.parentDocId ?? null;
  const siblings = docs.filter((doc) => (doc.parentDocId ?? null) === parentDocId);
  const index = siblings.findIndex((doc) => doc.id === id);
  return index >= 0 && index + 1 < siblings.length ? siblings[index + 1].id : null;
}

function DndRow({
  row,
  dropPosition,
  registerRow,
  styles,
  className,
  children,
  ...props
}: DndRowProps) {
  const data = useMemo<RowDndData>(() => ({
    id: row.id,
    parentDocId: row.parentDocId,
    depth: row.depth,
    hasChildren: row.hasChildren,
  }), [row.id, row.parentDocId, row.depth, row.hasChildren]);

  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: `${DRAG_PREFIX}${row.id}`,
    data,
  });
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `${DROP_PREFIX}${row.id}`,
    data,
  });

  const setRefs = useCallback((element: HTMLDivElement | null) => {
    setDraggableRef(element);
    setDroppableRef(element);
    registerRow(row.id, element);
  }, [registerRow, row.id, setDraggableRef, setDroppableRef]);

  const rowClassName = [
    styles.row,
    className,
    isDragging ? styles.dragging : undefined,
    dropPosition === 'before' ? styles.dropBefore : undefined,
    dropPosition === 'after' ? styles.dropAfter : undefined,
    dropPosition === 'inside' ? styles.dropInside : undefined,
  ].filter(Boolean).join(' ');

  return (
    <div
      {...attributes}
      {...listeners}
      {...props}
      ref={setRefs}
      className={rowClassName}
    >
      {children}
    </div>
  );
}

function BlankDropZone({ styles, active }: BlankDropZoneProps) {
  const { setNodeRef } = useDroppable({ id: BLANK_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      aria-hidden="true"
      className={`${styles.blankDropZone} ${active ? styles.blankDropActive : ''}`}
    />
  );
}

export default function PageTree({
  docs,
  currentDocId,
  loading,
  collapseAllSignal = 0,
  onSelect,
  onDelete,
}: PageTreeProps) {
  const { workspaceId, setDocs, create, reloadDocs } = useWorkspace();
  const [expandedMap, setExpandedMap] = useState<Record<string, string[]>>(() => ({
    [workspaceId]: readExpanded(workspaceId),
  }));
  const expanded = expandedMap[workspaceId] ?? readExpanded(workspaceId);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [movingDoc, setMovingDoc] = useState<DocSummary | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [moving, setMoving] = useState(false);

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameCommittedRef = useRef(false);
  const hoverTimerRef = useRef<{ id: string; timer: number } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  }));

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
    const walk = (node: TreeNode, depth: number, parentDocId: string | null) => {
      const hasChildren = node.children.length > 0;
      rows.push({ node, id: node.id, parentDocId, depth, hasChildren });
      if (hasChildren && expandedSet.has(node.id)) {
        node.children.forEach((child) => walk(child, depth + 1, node.id));
      }
    };
    tree.forEach((node) => walk(node, 0, null));
    return rows;
  }, [tree, expandedSet]);

  const registerRow = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) rowRefs.current.set(id, element);
    else rowRefs.current.delete(id);
  }, []);

  const focusRow = useCallback((id: string) => {
    window.requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
  }, []);

  const clearHoverTimer = useCallback(() => {
    const current = hoverTimerRef.current;
    if (!current) return;
    window.clearTimeout(current.timer);
    hoverTimerRef.current = null;
  }, []);

  const scheduleExpand = useCallback((id: string) => {
    if (hoverTimerRef.current?.id === id) return;
    clearHoverTimer();
    hoverTimerRef.current = {
      id,
      timer: window.setTimeout(() => {
        hoverTimerRef.current = null;
        updateExpanded((ids) => (ids.includes(id) ? ids : [...ids, id]));
      }, 600),
    };
  }, [clearHoverTimer, updateExpanded]);

  const performMove = useCallback(async (
    input: MoveDocInput,
    options?: { focus?: boolean; expandParent?: string | null },
  ) => {
    if (moving) return;
    setMoving(true);
    try {
      await moveDoc(input);
      await reloadDocs();
      if (options?.expandParent) {
        const parentId = options.expandParent;
        updateExpanded((ids) => (ids.includes(parentId) ? ids : [...ids, parentId]));
      }
      if (options?.focus) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => rowRefs.current.get(input.id)?.focus());
        });
      }
    } catch (error) {
      notifyError(error);
    } finally {
      setMoving(false);
    }
  }, [moving, reloadDocs, updateExpanded]);

  const readDropTarget = useCallback((
    event: DragOverEvent | DragEndEvent,
    invalidIds: Set<string>,
  ): DropTarget | null => {
    const over = event.over;
    if (!over) return null;
    if (over.id === BLANK_DROP_ID) {
      return { id: BLANK_DROP_ID, position: 'inside' };
    }
    const data = over.data.current;
    if (!isRowDndData(data) || invalidIds.has(data.id)) return null;
    const ratio = getPointerRatio(event, over.rect);
    if (ratio === null) return null;
    const position: DropPosition = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
    return { id: data.id, position };
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    clearHoverTimer();
    setDropTarget(null);
    if (!getActiveId(event.active.data.current)) return;
  }, [clearHoverTimer]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const activeId = getActiveId(event.active.data.current);
    const invalidIds = activeId ? collectRemoved(docs, activeId) : new Set<string>();
    const target = readDropTarget(event, invalidIds);
    setDropTarget(target);

    const data = event.over?.data.current;
    if (target?.position === 'inside' && isRowDndData(data)
      && data.hasChildren && !expandedSet.has(data.id)) {
      scheduleExpand(data.id);
    } else {
      clearHoverTimer();
    }
  }, [clearHoverTimer, docs, expandedSet, readDropTarget, scheduleExpand]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    clearHoverTimer();
    const activeId = getActiveId(event.active.data.current);
    const invalidIds = activeId ? collectRemoved(docs, activeId) : new Set<string>();
    const target = readDropTarget(event, invalidIds);
    setDropTarget(null);
    if (!activeId || !target || moving) return;

    if (target.id === BLANK_DROP_ID) {
      await performMove({ id: activeId, parentDocId: null, beforeDocId: null });
      return;
    }

    const data = event.over?.data.current;
    if (!isRowDndData(data)) return;

    let input: MoveDocInput;
    if (target.position === 'inside') {
      input = { id: activeId, parentDocId: data.id, beforeDocId: null };
    } else if (target.position === 'before') {
      input = { id: activeId, parentDocId: data.parentDocId, beforeDocId: data.id };
    } else {
      const nextId = getNextSiblingId(docs, data.id);
      if (nextId === activeId) return;
      input = { id: activeId, parentDocId: data.parentDocId, beforeDocId: nextId };
    }
    await performMove(input, { expandParent: target.position === 'inside' ? data.id : null });
  }, [clearHoverTimer, docs, moving, performMove, readDropTarget]);

  const handleDragCancel = useCallback(() => {
    clearHoverTimer();
    setDropTarget(null);
  }, [clearHoverTimer]);

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

  const handleMoved = useCallback((movedId: string, parentDocId: string | null) => {
    setDocs((prev) => prev.map((doc) => (
      doc.id === movedId ? { ...doc, parentDocId } : doc
    )));
    if (parentDocId) {
      updateExpanded((ids) => (ids.includes(parentDocId) ? ids : [...ids, parentDocId]));
    }
  }, [setDocs, updateExpanded]);

  const handleRowKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
    row: VisibleRow,
  ) => {
    if (renamingId === row.id) return;
    const { node, id, parentDocId, hasChildren } = row;
    const index = visibleRows.findIndex((item) => item.id === id);
    const isExpanded = expandedSet.has(id);

    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const siblings = visibleRows.filter((item) => item.parentDocId === parentDocId);
      const siblingIndex = siblings.findIndex((item) => item.id === id);
      const targetIndex = siblingIndex + (event.key === 'ArrowUp' ? -1 : 1);
      if (siblingIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
      const beforeDocId = event.key === 'ArrowUp'
        ? siblings[targetIndex].id
        : (siblings[siblingIndex + 2]?.id ?? null);
      void performMove(
        { id, parentDocId, beforeDocId },
        { focus: true },
      );
      return;
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        onSelect(id);
        break;
      case ' ':
        event.preventDefault();
        if (hasChildren) toggleExpanded(id);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (!hasChildren) break;
        if (!isExpanded) toggleExpanded(id);
        focusRow(node.children[0].id);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (hasChildren && isExpanded) {
          toggleExpanded(id);
        } else if (parentDocId) {
          focusRow(parentDocId);
        }
        break;
      case 'ArrowDown': {
        event.preventDefault();
        const next = visibleRows[index + 1];
        if (next) focusRow(next.id);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const previous = visibleRows[index - 1];
        if (previous) focusRow(previous.id);
        break;
      }
      default:
        break;
    }
  }, [expandedSet, focusRow, onSelect, performMove, renamingId, toggleExpanded, visibleRows]);

  const renderRow = (row: VisibleRow) => {
    const { node, parentDocId, hasChildren } = row;
    const isExpanded = expandedSet.has(node.id);
    const isCurrent = node.id === currentDocId;
    const isMenuTarget = menuState?.docId === node.id;
    const isRenaming = renamingId === node.id;
    const dropPosition = dropTarget?.id === node.id ? dropTarget.position : null;

    return (
      <DndRow
        key={node.id}
        row={row}
        dropPosition={dropPosition}
        registerRow={registerRow}
        styles={classes}
        role="treeitem"
        aria-selected={isCurrent || isMenuTarget}
        aria-expanded={hasChildren ? isExpanded : false}
        tabIndex={0}
        className={`${isCurrent ? classes.selected : ''} ${isMenuTarget ? classes.contextActive : ''}`}
        style={{ '--indent': `${row.depth * 12}px` } as CSSProperties}
        onClick={() => {
          if (!isRenaming) onSelect(node.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMenuState({ docId: node.id, x: event.clientX, y: event.clientY });
          rowRefs.current.get(node.id)?.focus();
        }}
        onKeyDown={(event) => handleRowKeyDown(event, row)}
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
      </DndRow>
    );
  };

  const menuDoc = menuState ? docs.find((doc) => doc.id === menuState.docId) : undefined;
  const blankActive = dropTarget?.id === BLANK_DROP_ID;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={handleDragCancel}
    >
      {loading ? (
        <Text className={classes.empty} size="xs">正在加载文档…</Text>
      ) : !tree.length ? (
        <Text className={classes.empty} size="xs">还没有文档</Text>
      ) : (
        <>
          <div role="tree" className={classes.tree}>
            {visibleRows.map(renderRow)}
          </div>
          <BlankDropZone styles={classes} active={blankActive} />
        </>
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
            leftSection={<IconArrowsMove size={15} stroke={1.7} />}
            disabled={!menuDoc}
            onClick={() => {
              if (!menuDoc) return;
              setMenuState(null);
              setMovingDoc(menuDoc);
            }}
          >
            移动到…
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
      {movingDoc && (
        <MoveDocDialog
          opened
          doc={movingDoc}
          docs={docs}
          onClose={() => setMovingDoc(null)}
          onMoved={handleMoved}
        />
      )}
    </DndContext>
  );
}
