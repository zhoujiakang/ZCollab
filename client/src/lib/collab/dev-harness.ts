import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { apiPost } from '../../api/client';
import { getCollabBaseUrl } from './url';

/** 第 6 步接正式界面时删除：仅用于浏览器控制台验证内存同步。 */
export function createDevDoc(docId: string) {
  const doc = new Y.Doc();
  // y-websocket 3.1.0 的签名为 (serverUrl, roomname, doc, opts)。
  const provider = new WebsocketProvider(getCollabBaseUrl(), docId, doc);
  return { doc, provider };
}

/** 把完整文档算成快照提交给服务端，并清掉已被覆盖的历史 update。 */
export async function compactDoc(doc: Y.Doc, docId: string): Promise<void> {
  const bytes = Y.encodeStateAsUpdate(doc);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  await apiPost<boolean>('/doc/compact', { id: docId, snapshot: btoa(binary) });
}

declare global {
  interface Window {
    createDevDoc: typeof createDevDoc;
    compactDoc: typeof compactDoc;
  }
}

window.createDevDoc = createDevDoc;
window.compactDoc = compactDoc;
