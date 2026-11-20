/** WebSocket 协同端点前缀；同源地址，跟随 Vite 实际端口。 */
export function getCollabBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/collab`;
}

/**
 * 房间号即文档 id，放在 URL 路径上；二进制帧里不再携带房间标识。
 */
export function getCollabUrl(docId: string): string {
  return `${getCollabBaseUrl()}/${encodeURIComponent(docId)}`;
}

declare global {
  interface Window {
    getCollabUrl: typeof getCollabUrl;
    getCollabBaseUrl: typeof getCollabBaseUrl;
  }
}

// 便于在浏览器控制台直接执行 getCollabUrl('123') 做验证。
window.getCollabUrl = getCollabUrl;
window.getCollabBaseUrl = getCollabBaseUrl;
