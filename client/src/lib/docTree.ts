import type { DocSummary } from '../api/doc';

export interface TreeNode extends DocSummary {
  children: TreeNode[];
}

export function buildTree(docs: DocSummary[]): TreeNode[] {
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

export function collectRemoved(docs: DocSummary[], rootId: string): Set<string> {
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

export function getDocPath(docs: DocSummary[], docId: string | undefined): DocSummary[] {
  if (!docId) return [];
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const path: DocSummary[] = [];
  const visited = new Set<string>();
  let current = byId.get(docId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentDocId ? byId.get(current.parentDocId) : undefined;
  }
  return path;
}
