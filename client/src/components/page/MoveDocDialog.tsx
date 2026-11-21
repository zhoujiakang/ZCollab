import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ActionIcon, Button, Group, Modal, ScrollArea, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronRight } from '@tabler/icons-react';
import { moveDoc, type DocSummary } from '../../api/doc';
import { buildTree, collectRemoved, getDocPath, type TreeNode } from '../../lib/docTree';

interface MoveDocDialogProps {
  opened: boolean;
  doc: DocSummary;
  docs: DocSummary[];
  onClose: () => void;
  onMoved: (movedId: string, parentDocId: string | null) => void;
}

interface TargetRow {
  node: TreeNode;
  depth: number;
  expanded: boolean;
}

type SelectedTarget = string | null | undefined;

function withoutExcluded(nodes: TreeNode[], excluded: Set<string>): TreeNode[] {
  return nodes
    .filter((node) => !excluded.has(node.id))
    .map((node) => ({ ...node, children: withoutExcluded(node.children, excluded) }));
}

function rowStyle(depth: number, selected: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    minHeight: 30,
    padding: '4px 8px',
    paddingLeft: 8 + depth * 16,
    borderRadius: 'var(--mantine-radius-sm)',
    background: selected ? 'var(--mantine-color-blue-light)' : 'transparent',
    color: selected ? 'var(--mantine-color-blue-filled)' : 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  };
}

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

export default function MoveDocDialog({ opened, doc, docs, onClose, onMoved }: MoveDocDialogProps) {
  const [selected, setSelected] = useState<SelectedTarget>(undefined);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setSelected(undefined);
    setBusy(false);
    setExpanded(new Set(getDocPath(docs, doc.parentDocId ?? undefined).map((item) => item.id)));
    // 只在打开或切换目标文档时重置弹窗状态。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, doc.id]);

  const excluded = useMemo(() => collectRemoved(docs, doc.id), [docs, doc.id]);
  const tree = useMemo(() => withoutExcluded(buildTree(docs), excluded), [docs, excluded]);

  const rows = useMemo(() => {
    const result: TargetRow[] = [];
    const walk = (node: TreeNode, depth: number) => {
      const isExpanded = expanded.has(node.id);
      result.push({ node, depth, expanded: isExpanded });
      if (node.children.length && isExpanded) {
        node.children.forEach((child) => walk(child, depth + 1));
      }
    };
    tree.forEach((node) => walk(node, 0));
    return result;
  }, [tree, expanded]);

  const isCurrentParent = selected === doc.parentDocId;
  const canMove = selected !== undefined && !isCurrentParent;

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, target: string | null) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelected(target);
  };

  const handleMove = async () => {
    if (selected === undefined || isCurrentParent || busy) return;
    setBusy(true);
    try {
      await moveDoc(doc.id, selected);
      notifications.show({ color: 'green', title: '已移动', message: '' });
      onMoved(doc.id, selected);
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="移动到…" centered size="sm">
      <ScrollArea h={280} type="auto">
        <div
          role="button"
          tabIndex={0}
          style={rowStyle(0, selected === null)}
          onClick={() => setSelected(null)}
          onKeyDown={(event) => handleKeyDown(event, null)}
        >
          <span style={{ width: 22, flexShrink: 0 }} aria-hidden="true" />
          <Text size="sm">顶层</Text>
        </div>
        {rows.map(({ node, depth, expanded: isExpanded }) => (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            style={rowStyle(depth, selected === node.id)}
            onClick={() => setSelected(node.id)}
            onKeyDown={(event) => handleKeyDown(event, node.id)}
          >
            {node.children.length ? (
              <ActionIcon
                size="compact-xs"
                variant="transparent"
                aria-label={isExpanded ? '折叠' : '展开'}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleExpanded(node.id);
                }}
              >
                <IconChevronRight
                  size={14}
                  stroke={1.7}
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                />
              </ActionIcon>
            ) : (
              <span style={{ width: 22, flexShrink: 0 }} aria-hidden="true" />
            )}
            <Text size="sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.title || '无标题'}
            </Text>
          </div>
        ))}
      </ScrollArea>
      <Group justify="flex-end" gap="sm" mt="md" wrap="nowrap">
        <Button variant="default" onClick={onClose}>取消</Button>
        <Button color="blue" loading={busy} disabled={!canMove} onClick={() => void handleMove()}>
          移动
        </Button>
      </Group>
    </Modal>
  );
}
