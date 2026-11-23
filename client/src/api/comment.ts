import { apiPost, apiPostVoid } from './client';

export interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface DocComment {
  id: string;
  parentId: string | null;
  quote: string | null;
  body: string;
  author: CommentAuthor;
  createdAt: string;
  resolvedAt: string | null;
  anchorFrom: number | null;
  anchorTo: number | null;
  canDelete: boolean;
  replies: DocComment[];
}

export interface CreateCommentInput {
  docId: string;
  parentId: string | null;
  body: string;
  quote: string | null;
  anchorFrom: number | null;
  anchorTo: number | null;
}

export function listComments(docId: string): Promise<DocComment[]> {
  return apiPost<DocComment[]>('/doc/comment/list', { docId });
}

export function createComment(input: CreateCommentInput): Promise<DocComment> {
  return apiPost<DocComment>('/doc/comment/create', input);
}

export function resolveComment(id: string, resolved: boolean): Promise<void> {
  return apiPostVoid('/doc/comment/resolve', { id, resolved });
}

export function deleteComment(id: string): Promise<void> {
  return apiPostVoid('/doc/comment/delete', { id });
}
