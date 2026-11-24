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
import {
  createDoc,
  deleteDoc,
  importDoc,
  listDocs,
  listFavorites,
  listRecentDocs,
  toggleFavorite as toggleFavoriteApi,
  type Doc,
  type DocSummary,
  type FavoriteDoc,
  type RecentDoc,
} from '../api/doc';
import { collectRemoved } from '../lib/docTree';
import { markdownToDoc } from '../lib/markdownImport';
import type { DocTemplate } from '../lib/docTemplates';

export interface WorkspaceContextValue {
  workspaceId: string;
  docs: DocSummary[];
  loadingDocs: boolean;
  favorites: FavoriteDoc[];
  recent: RecentDoc[];
  favoriteIds: Set<string>;
  setDocs: Dispatch<SetStateAction<DocSummary[]>>;
  reloadDocs: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  refreshRecent: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<boolean>;
  registerFlush: (flush: (() => Promise<void>) | null) => void;
  flushPendingSave: () => Promise<void>;
  create: (parentDocId?: string | null) => Promise<Doc>;
  createFromTemplate: (template: DocTemplate, parentDocId?: string | null) => Promise<Doc>;
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
  const [favorites, setFavorites] = useState<FavoriteDoc[]>([]);
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const favoritesRequestRef = useRef(0);
  const recentRequestRef = useRef(0);

  const reloadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      setDocs(await listDocs(workspaceId));
    } catch (error) {
      notifyError(error);
    } finally {
      setLoadingDocs(false);
    }
  }, [workspaceId]);

  const refreshFavorites = useCallback(async () => {
    const request = ++favoritesRequestRef.current;
    try {
      const items = await listFavorites(workspaceId);
      if (request === favoritesRequestRef.current) setFavorites(items);
    } catch {
      if (request === favoritesRequestRef.current) setFavorites([]);
    }
  }, [workspaceId]);

  const refreshRecent = useCallback(async () => {
    const request = ++recentRequestRef.current;
    try {
      const items = await listRecentDocs(workspaceId);
      if (request === recentRequestRef.current) setRecent(items);
    } catch {
      if (request === recentRequestRef.current) setRecent([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    let active = true;
    setDocs([]);
    setFavorites([]);
    setRecent([]);
    favoritesRequestRef.current += 1;
    recentRequestRef.current += 1;
    setLoadingDocs(true);
    listDocs(workspaceId)
      .then((items) => {
        if (active) setDocs(items);
      })
      .catch(notifyError)
      .finally(() => {
        if (active) setLoadingDocs(false);
      });
    void refreshFavorites();
    void refreshRecent();
    return () => {
      active = false;
    };
  }, [workspaceId, refreshFavorites, refreshRecent]);

  const registerFlush = useCallback((flush: (() => Promise<void>) | null) => {
    flushRef.current = flush ?? (() => Promise.resolve());
  }, []);

  const flushPendingSave = useCallback(() => flushRef.current(), []);

  const create = useCallback(
    async (parentDocId?: string | null) => {
      await flushPendingSave();
      const doc = await createDoc(parentDocId ?? null, workspaceId);
      setDocs((prev) => [...prev, { id: doc.id, parentDocId: doc.parentDocId, title: doc.title }]);
      return doc;
    },
    [flushPendingSave, workspaceId],
  );

  const createFromTemplate = useCallback(
    async (template: DocTemplate, parentDocId?: string | null) => {
      await flushPendingSave();
      if (!template.markdown.trim()) return create(parentDocId);
      const { json, text } = markdownToDoc(template.markdown);
      const doc = await importDoc({
        title: template.defaultTitle(new Date()),
        parentId: parentDocId ?? null,
        content: JSON.stringify(json),
        contentText: text,
      }, workspaceId);
      setDocs((prev) => [...prev, { id: doc.id, parentDocId: doc.parentDocId, title: doc.title }]);
      return doc;
    },
    [create, flushPendingSave, workspaceId],
  );

  const remove = useCallback(
    async (id: string) => {
      await flushPendingSave();
      await deleteDoc(id, workspaceId);
      setDocs((prev) => {
        const removed = collectRemoved(prev, id);
        return prev.filter((item) => !removed.has(item.id));
      });
      await Promise.all([refreshFavorites(), refreshRecent()]);
    },
    [flushPendingSave, refreshFavorites, refreshRecent, workspaceId],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      try {
        const favorite = await toggleFavoriteApi(id);
        await Promise.all([refreshFavorites(), refreshRecent()]);
        return favorite;
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [refreshFavorites, refreshRecent],
  );

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaceId, docs, loadingDocs, favorites, recent, favoriteIds,
      setDocs, reloadDocs, refreshFavorites, refreshRecent, toggleFavorite,
      registerFlush, flushPendingSave, create, createFromTemplate, remove,
    }),
    [
      workspaceId, docs, loadingDocs, favorites, recent, favoriteIds,
      reloadDocs, refreshFavorites, refreshRecent, toggleFavorite,
      registerFlush, flushPendingSave, create, createFromTemplate, remove,
    ],
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
