export interface RecentDoc {
  id: string;
  title: string;
}

const RECENT_KEY_PREFIX = 'zc:recent-docs:';
const RECENT_LIMIT = 5;

function storageKey(workspaceId: string) {
  return `${RECENT_KEY_PREFIX}${workspaceId}`;
}

export function readRecentDocs(workspaceId: string): RecentDoc[] {
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentDoc => (
        Boolean(item)
        && typeof item === 'object'
        && typeof (item as RecentDoc).id === 'string'
        && typeof (item as RecentDoc).title === 'string'
      ))
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function recordRecentDoc(workspaceId: string, doc: RecentDoc): void {
  try {
    const next = [doc, ...readRecentDocs(workspaceId).filter((item) => item.id !== doc.id)]
      .slice(0, RECENT_LIMIT);
    window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(next));
  } catch {
    // 存储不可用时忽略最近打开记录
  }
}
