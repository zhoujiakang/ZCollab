import { apiPost } from './client';

export interface DocSummary {
  id: string;
  parentDocId: string | null;
  title: string;
}

export interface Doc {
  id: string;
  parentDocId: string | null;
  title: string;
  content: string;
}

export function listDocs(): Promise<DocSummary[]> {
  return apiPost<DocSummary[]>('/doc/list');
}

export function createDoc(parentDocId?: string | null): Promise<Doc> {
  return apiPost<Doc>('/doc/create', { parentDocId: parentDocId ?? null });
}

export function getDoc(id: string): Promise<Doc> {
  return apiPost<Doc>('/doc/get', { id });
}

export function updateDoc(id: string, values: { title?: string; content?: string }): Promise<Doc> {
  return apiPost<Doc>('/doc/update', { id, ...values });
}

export function deleteDoc(id: string): Promise<void> {
  return apiPost<boolean>('/doc/delete', { id }).then(() => undefined);
}
