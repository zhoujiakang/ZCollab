import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getCollabBaseUrl } from './url';

/** 第 6 步接正式界面时删除：仅用于浏览器控制台验证内存同步。 */
export function createDevDoc(docId: string) {
  const doc = new Y.Doc();
  // y-websocket 3.1.0 的签名为 (serverUrl, roomname, doc, opts)。
  const provider = new WebsocketProvider(getCollabBaseUrl(), docId, doc);
  return { doc, provider };
}

declare global {
  interface Window {
    createDevDoc: typeof createDevDoc;
  }
}

window.createDevDoc = createDevDoc;
