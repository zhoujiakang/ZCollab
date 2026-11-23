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
  const [comments, setComments] = useState<DocComment[]>([]);
  const requestSeq = useRef(0);

  const reload = useCallback(async () => {
    if (!docId) return;
    const seq = ++requestSeq.current;
    const next = await listComments(docId);
    if (seq === requestSeq.current) setComments(next);
  }, [docId]);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

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

  return { comments, reload, create, resolve, remove };
}
