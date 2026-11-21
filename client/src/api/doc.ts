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
  contentText: string;
  updatedAt: string | null;
}

export interface DocSearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export function listDocs(): Promise<DocSummary[]> {
  return apiPost<DocSummary[]>('/doc/list');
}

export function searchDocs(keyword: string): Promise<DocSearchResult[]> {
  return apiPost<DocSearchResult[]>('/doc/search', { keyword });
}

export function createDoc(parentDocId?: string | null): Promise<Doc> {
  return apiPost<Doc>('/doc/create', { parentDocId: parentDocId ?? null });
}

export function getDoc(id: string): Promise<Doc> {
  return apiPost<Doc>('/doc/get', { id });
}

export function claimSeedDoc(id: string): Promise<boolean> {
  return apiPost<boolean>('/doc/claim-seed', { id });
}

export function updateDoc(id: string, values: { title?: string; content?: string; text?: string }): Promise<Doc> {
  return apiPost<Doc>('/doc/update', { id, ...values });
}

export function deleteDoc(id: string): Promise<void> {
  return apiPost<boolean>('/doc/delete', { id }).then(() => undefined);
}

export function moveDoc(id: string, parentDocId: string | null): Promise<void> {
  return apiPost<boolean>('/doc/move', { id, parentDocId }).then(() => undefined);
}
