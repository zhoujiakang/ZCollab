import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { apiPost, apiPostVoid } from '../api/client';
import { getCollabBaseUrl } from '../lib/collab/url';
import { workspaceConfig } from '../lib/workspaceScope';
import { buildCompactSnapshot, type PersistedDocState } from '../lib/collab/snapshot';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

interface CollabSession {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
}

async function compactSnapshot(docId: string, ydoc: Y.Doc, workspaceId: string): Promise<void> {
  try {
    // 卸载会销毁 ydoc，必须在第一个 await 之前保留本地内容。
    const local = Y.encodeStateAsUpdate(ydoc);
    const state = await apiPost<PersistedDocState>('/doc/compact/prepare', { id: docId }, workspaceConfig(workspaceId));
    await apiPostVoid('/doc/compact', {
      id: docId,
      snapshot: buildCompactSnapshot(local, state),
      version: state.version,
    }, workspaceConfig(workspaceId));
  } catch {
    // 有其他编辑或版本发生变化时跳过收缩，保留持久化增量；不打断切文档/卸载。
  }
}

/** 每个文档独占一个 Y.Doc 和一个 WebSocketProvider；连接状态变化不重建 editor。 */
export function useCollabDoc(docId: string | null, workspaceId: string) {
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
        void compactSnapshot(leavingDocId, ydoc, workspaceId);
      }
      provider.destroy();
      ydoc.destroy();
      setSession(null);
    };
  }, [docId, workspaceId]);

  return { ydoc: session?.ydoc ?? null, provider: session?.provider ?? null, status };
}
