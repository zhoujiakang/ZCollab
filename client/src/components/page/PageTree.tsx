import type { CSSProperties } from 'react';
import { ActionIcon, Text } from '@mantine/core';
import { IconFileText, IconTrash } from '@tabler/icons-react';
import type { DocSummary } from '../../api/doc';
import { buildTree, type TreeNode } from '../../lib/docTree';
import classes from './PageTree.module.css';

interface PageTreeProps {
  docs: DocSummary[];
  currentDocId?: string;
  loading?: boolean;
  onSelect: (docId: string) => void;
  onDelete: (docId: string, title: string) => void;
}

export default function PageTree({ docs, currentDocId, loading, onSelect, onDelete }: PageTreeProps) {
  const renderNode = (node: TreeNode, depth: number) => (
    <div key={node.id}>
      <div
        role="treeitem"
        aria-selected={node.id === currentDocId}
        tabIndex={0}
        className={`${classes.row} ${node.id === currentDocId ? classes.selected : ''}`}
        style={{ '--indent': `${depth * 12}px` } as CSSProperties}
        onClick={() => onSelect(node.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(node.id);
          }
        }}
      >
        <span className={classes.icon}><IconFileText size={14} stroke={1.7} /></span>
        <span className={classes.title}>{node.title || '无标题'}</span>
        <ActionIcon
          className={classes.delete}
          size="compact-xs"
          variant="subtle"
          color="red"
          aria-label="删除文档"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(node.id, node.title);
          }}
        >
          <IconTrash size={13} stroke={1.7} />
        </ActionIcon>
      </div>
      {node.children.map((child) => renderNode(child, depth + 1))}
    </div>
  );

  const tree = buildTree(docs);

  if (loading) return <Text className={classes.empty} size="xs">正在加载文档…</Text>;
  if (!tree.length) return <Text className={classes.empty} size="xs">还没有文档</Text>;

  return <div role="tree" className={classes.tree}>{tree.map((node) => renderNode(node, 0))}</div>;
}
