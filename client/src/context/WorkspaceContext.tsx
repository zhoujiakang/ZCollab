import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { notifications } from '@mantine/notifications';
import { createDoc, deleteDoc, listDocs, type Doc, type DocSummary } from '../api/doc';
import { collectRemoved } from '../lib/docTree';

export interface WorkspaceContextValue {
  workspaceId: string;
  docs: DocSummary[];
  loadingDocs: boolean;
  setDocs: Dispatch<SetStateAction<DocSummary[]>>;
  reloadDocs: () => Promise<void>;
  registerFlush: (flush: (() => Promise<void>) | null) => void;
  flushPendingSave: () => Promise<void>;
  create: (parentDocId?: string | null) => Promise<Doc>;
  remove: (id: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceBridgeValue {
  workspace: WorkspaceContextValue | null;
  setWorkspace: (value: WorkspaceContextValue | null) => void;
}

const WorkspaceBridgeContext = createContext<WorkspaceBridgeValue | null>(null);

export function WorkspaceBridgeProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspaceState] = useState<WorkspaceContextValue | null>(null);
  const setWorkspace = useCallback((value: WorkspaceContextValue | null) => {
    setWorkspaceState(value);
  }, []);
  const value = useMemo<WorkspaceBridgeValue>(() => ({ workspace, setWorkspace }), [workspace, setWorkspace]);
  return <WorkspaceBridgeContext.Provider value={value}>{children}</WorkspaceBridgeContext.Provider>;
}

export function useWorkspaceBridge() {
  const context = useContext(WorkspaceBridgeContext);
  if (!context) throw new Error('useWorkspaceBridge 必须在 WorkspaceBridgeProvider 内使用');
  return context;
}

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

export function WorkspaceProvider({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const { setWorkspace } = useWorkspaceBridge();
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const reloadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      setDocs(await listDocs());
    } catch (error) {
      notifyError(error);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setDocs([]);
    setLoadingDocs(true);
    listDocs()
      .then((items) => {
        if (active) setDocs(items);
      })
      .catch(notifyError)
      .finally(() => {
        if (active) setLoadingDocs(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const registerFlush = useCallback((flush: (() => Promise<void>) | null) => {
    flushRef.current = flush ?? (() => Promise.resolve());
  }, []);

  const flushPendingSave = useCallback(() => flushRef.current(), []);

  const create = useCallback(
    async (parentDocId?: string | null) => {
      await flushPendingSave();
      const doc = await createDoc(parentDocId ?? null);
      setDocs((prev) => [...prev, { id: doc.id, parentDocId: doc.parentDocId, title: doc.title }]);
      return doc;
    },
    [flushPendingSave],
  );

  const remove = useCallback(
    async (id: string) => {
      await flushPendingSave();
      await deleteDoc(id);
      setDocs((prev) => {
        const removed = collectRemoved(prev, id);
        return prev.filter((item) => !removed.has(item.id));
      });
    },
    [flushPendingSave],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({ workspaceId, docs, loadingDocs, setDocs, reloadDocs, registerFlush, flushPendingSave, create, remove }),
    [workspaceId, docs, loadingDocs, reloadDocs, registerFlush, flushPendingSave, create, remove],
  );

  useEffect(() => {
    setWorkspace(value);
  }, [setWorkspace, value]);

  useEffect(() => () => setWorkspace(null), [setWorkspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace 必须在 WorkspaceProvider 内使用');
  return context;
}

export function useOptionalWorkspace() {
  return useContext(WorkspaceContext);
}
