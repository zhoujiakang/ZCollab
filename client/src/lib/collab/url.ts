/** WebSocket 协同端点前缀；同源地址，跟随 Vite 实际端口。 */
export function getCollabBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/collab`;
}
