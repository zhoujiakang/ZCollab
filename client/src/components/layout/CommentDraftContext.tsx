import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CommentDraft {
  quote: string;
  from: number;
  to: number;
  key: number;
}

interface CommentDraftContextValue {
  draft: CommentDraft | null;
  setDraft: (draft: CommentDraft | null) => void;
}

const CommentDraftContext = createContext<CommentDraftContextValue | null>(null);

export function CommentDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<CommentDraft | null>(null);
  const setDraft = useCallback((next: CommentDraft | null) => setDraftState(next), []);
  const value = useMemo(() => ({ draft, setDraft }), [draft, setDraft]);
  return <CommentDraftContext.Provider value={value}>{children}</CommentDraftContext.Provider>;
}

export function useCommentDraft() {
  const context = useContext(CommentDraftContext);
  if (!context) throw new Error('useCommentDraft 必须在 CommentDraftProvider 内使用');
  return context;
}
