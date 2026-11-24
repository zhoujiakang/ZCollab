import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createComment,
  deleteComment,
  listComments,
  resolveComment,
  type CreateCommentInput,
  type DocComment,
} from '../../api/comment';

export function useComments(docId: string | undefined) {
  const [state, setState] = useState<{ docId: string | undefined; comments: DocComment[] }>({ docId, comments: [] });
  const requestSeq = useRef(0);
  const activeDocId = useRef(docId);
  activeDocId.current = docId;

  const reload = useCallback(async () => {
    if (!docId || activeDocId.current !== docId) return;
    const seq = ++requestSeq.current;
    const next = await listComments(docId);
    if (seq === requestSeq.current && activeDocId.current === docId) {
      setState({ docId, comments: next });
    }
  }, [docId]);

  useEffect(() => {
    activeDocId.current = docId;
    setState({ docId, comments: [] });
    void reload().catch(() => undefined);
    return () => {
      requestSeq.current += 1;
      if (activeDocId.current === docId) activeDocId.current = undefined;
    };
  }, [docId, reload]);

  const create = useCallback(async (input: CreateCommentInput) => {
    await createComment(input);
    await reload();
  }, [reload]);

  const resolve = useCallback(async (id: string, resolved: boolean) => {
    await resolveComment(id, resolved);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await deleteComment(id);
    await reload();
  }, [reload]);

  // Hide the preceding document's comments during the render before the new effect runs.
  const comments = state.docId === docId ? state.comments : [];
  return { comments, reload, create, resolve, remove };
}
