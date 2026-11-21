import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { apiPostVoid } from '../api/client';
import { getCollabBaseUrl } from '../lib/collab/url';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

interface CollabSession {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
}

async function compactSnapshot(docId: string, ydoc: Y.Doc): Promise<void> {
  try {
    const bytes = Y.encodeStateAsUpdate(ydoc);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    await apiPostVoid('/doc/compact', { id: docId, snapshot: btoa(binary) });
  } catch {
    // 409 表示房间里还有别人，内容仍在增量里；其他失败也不打断切文档/卸载。
  }
}

/** 每个文档独占一个 Y.Doc 和一个 WebSocketProvider；连接状态变化不重建 editor。 */
export function useCollabDoc(docId: string | null) {
  const [session, setSession] = useState<CollabSession | null>(null);
  const [status, setStatus] = useState<CollabStatus>('connecting');

  useEffect(() => {
    if (!docId) {
      setSession(null);
      setStatus('connecting');
      return;
    }

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(getCollabBaseUrl(), docId, ydoc, { disableBc: true });
    setSession({ ydoc, provider });
    setStatus(provider.wsconnected ? 'connected' : 'connecting');

    const onStatus = (event: { status: string }) => {
      if (event.status === 'connected') setStatus('connected');
      else if (event.status === 'disconnected') setStatus('disconnected');
      else setStatus('connecting');
    };
    provider.on('status', onStatus);

    const leavingDocId = docId;
    return () => {
      provider.off('status', onStatus);
      if (ydoc.getXmlFragment('content').length > 0) {
        void compactSnapshot(leavingDocId, ydoc);
      }
      provider.destroy();
      ydoc.destroy();
      setSession(null);
    };
  }, [docId]);

  return { ydoc: session?.ydoc ?? null, provider: session?.provider ?? null, status };
}
