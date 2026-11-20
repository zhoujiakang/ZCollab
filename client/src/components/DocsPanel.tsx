import { useEffect, useMemo, useState } from 'react';
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
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  createDoc,
  deleteDoc,
  getDoc,
  listDocs,
  updateDoc,
  type Doc,
  type DocSummary,
} from '../api/doc';

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

interface DocsPanelProps {
  workspaceId: string;
}

export default function DocsPanel({ workspaceId }: DocsPanelProps) {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setSelected(null);
    setTitle('');
    setContent('');
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
  }, [workspaceId]);

  const tree = useMemo(() => buildTree(docs), [docs]);

  const selectDoc = (id: string) => {
    setBusy(true);
    getDoc(id)
      .then((doc) => {
        setSelected(doc);
        setTitle(doc.title);
        setContent(doc.content);
      })
      .catch(notifyError)
      .finally(() => setBusy(false));
  };

  const handleCreate = () => {
    setBusy(true);
    createDoc(selected?.id)
      .then((doc) => {
        setDocs((prev) => [...prev, { id: doc.id, parentDocId: doc.parentDocId, title: doc.title }]);
        setSelected(doc);
        setTitle(doc.title);
        setContent(doc.content);
      })
      .catch(notifyError)
      .finally(() => setBusy(false));
  };

  const handleSave = () => {
    if (!selected) return;
    setBusy(true);
    updateDoc(selected.id, { title, content })
      .then((doc) => {
        setSelected(doc);
        setTitle(doc.title);
        setContent(doc.content);
        setDocs((prev) => prev.map((item) => (item.id === doc.id ? { ...item, title: doc.title } : item)));
        notifications.show({ color: 'green', title: '保存成功', message: '' });
      })
      .catch(notifyError)
      .finally(() => setBusy(false));
  };

  const handleDelete = (id: string, docTitle: string) => {
    if (!window.confirm(`确定删除「${docTitle || '无标题'}」及其所有子文档吗？`)) return;
    setBusy(true);
    deleteDoc(id)
      .then(() => {
        const removed = collectRemoved(docs, id);
        setDocs((prev) => prev.filter((item) => !removed.has(item.id)));
        if (selected && removed.has(selected.id)) {
          setSelected(null);
          setTitle('');
          setContent('');
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
              <Group justify="flex-end">
                <Button size="compact-sm" loading={busy} onClick={handleSave}>保存</Button>
              </Group>
              <TextInput
                variant="unstyled"
                aria-label="文档标题"
                placeholder="无标题"
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
                styles={{ input: { fontSize: 30, fontWeight: 600, padding: 0 } }}
              />
              <Textarea
                variant="unstyled"
                aria-label="文档正文"
                placeholder="开始写点什么…"
                value={content}
                onChange={(event) => setContent(event.currentTarget.value)}
                minRows={16}
                styles={{ input: { fontSize: 15, lineHeight: 1.7, padding: 0 } }}
              />
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
