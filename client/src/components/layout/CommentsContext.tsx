import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import type { CreateCommentInput, DocComment } from '../../api/comment';
import { useComments } from '../page/useComments';

interface CommentsContextValue {
  comments: DocComment[];
  create: (input: CreateCommentInput) => Promise<void>;
  resolve: (id: string, resolved: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  /** 当前在正文里成功定位到的评论 id；用于列表上的「原文已修改」降级标记。 */
  locatedIds: Set<string>;
  locatedReady: boolean;
  reportLocatedIds: (ids: Set<string>) => void;
}

const CommentsContext = createContext<CommentsContextValue | null>(null);

export function CommentsProvider({ children }: { children: ReactNode }) {
  const { docId } = useParams();
  const { comments, create, resolve, remove } = useComments(docId);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [locatedIds, setLocatedIds] = useState<Set<string>>(() => new Set());
  const [locatedReady, setLocatedReady] = useState(false);

  useEffect(() => {
    setActiveIdState(null);
    setLocatedIds(new Set());
    setLocatedReady(false);
  }, [docId]);

  const setActiveId = useCallback((id: string | null) => setActiveIdState(id), []);
  const reportLocatedIds = useCallback((ids: Set<string>) => {
    setLocatedIds((prev) => {
      if (prev.size === ids.size && [...ids].every((id) => prev.has(id))) return prev;
      return ids;
    });
    setLocatedReady(true);
  }, []);

  const value = useMemo<CommentsContextValue>(() => ({
    comments, create, resolve, remove,
    activeId, setActiveId,
    locatedIds, locatedReady, reportLocatedIds,
  }), [comments, create, resolve, remove, activeId, setActiveId, locatedIds, locatedReady, reportLocatedIds]);

  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>;
}

export function useCommentsContext() {
  const context = useContext(CommentsContext);
  if (!context) throw new Error('useCommentsContext 必须在 CommentsProvider 内使用');
  return context;
}
