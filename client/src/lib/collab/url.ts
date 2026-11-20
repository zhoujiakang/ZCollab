/**
 * 房间号即文档 id，放在 URL 路径上；二进制帧里不再携带房间标识。
 */
export function getCollabUrl(docId: string): string {
  const path = `/collab/${encodeURIComponent(docId)}`;
  if (import.meta.env.DEV) {
    return `ws://localhost:8080${path}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

declare global {
  interface Window {
    getCollabUrl: typeof getCollabUrl;
  }
}

// 便于在浏览器控制台直接执行 getCollabUrl('123') 做验证。
window.getCollabUrl = getCollabUrl;
