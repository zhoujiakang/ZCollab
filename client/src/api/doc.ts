import { apiPost, apiPostVoid } from './client';
import { workspaceConfig } from '../lib/workspaceScope';

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

export interface ImportDocInput {
  title: string;
  parentId: string | null;
  content: string;
  contentText: string;
}

export interface FavoriteDoc {
  id: string;
  title: string;
}

export interface RecentDoc {
  id: string;
  title: string;
  visitedAt: string;
}

export function listDocs(workspaceId?: string): Promise<DocSummary[]> {
  return apiPost<DocSummary[]>('/doc/list', {}, workspaceConfig(workspaceId));
}

export function searchDocs(keyword: string): Promise<DocSearchResult[]> {
  return apiPost<DocSearchResult[]>('/doc/search', { keyword });
}

export function createDoc(parentDocId?: string | null, workspaceId?: string): Promise<Doc> {
  return apiPost<Doc>('/doc/create', { parentDocId: parentDocId ?? null }, workspaceConfig(workspaceId));
}

export function importDoc(input: ImportDocInput, workspaceId?: string): Promise<Doc> {
  return apiPost<Doc>('/doc/import', input, { ...workspaceConfig(workspaceId), timeout: 60000 });
}

export function getDoc(id: string, workspaceId?: string): Promise<Doc> {
  return apiPost<Doc>('/doc/get', { id }, workspaceConfig(workspaceId));
}

export function claimSeedDoc(id: string): Promise<boolean> {
  return apiPost<boolean>('/doc/claim-seed', { id });
}

export function updateDoc(id: string, values: { title?: string; content?: string; text?: string }, workspaceId?: string): Promise<Doc> {
  return apiPost<Doc>('/doc/update', { id, ...values }, workspaceConfig(workspaceId));
}

export function deleteDoc(id: string, workspaceId?: string): Promise<void> {
  return apiPostVoid('/doc/delete', { id }, workspaceConfig(workspaceId));
}

export interface MoveDocInput {
  id: string;
  parentDocId: string | null;
  beforeDocId?: string | null;
}

export function moveDoc({ id, parentDocId, beforeDocId = null }: MoveDocInput): Promise<void> {
  return apiPostVoid('/doc/move', { id, parentDocId, beforeDocId });
}

export function toggleFavorite(id: string): Promise<boolean> {
  return apiPost<boolean>('/doc/favorite/toggle', { id });
}

export function listFavorites(workspaceId?: string): Promise<FavoriteDoc[]> {
  return apiPost<FavoriteDoc[]>('/doc/favorites', {}, workspaceConfig(workspaceId));
}

export function visitDoc(id: string): Promise<void> {
  return apiPostVoid('/doc/visit', { id });
}

export function listRecentDocs(workspaceId?: string): Promise<RecentDoc[]> {
  return apiPost<RecentDoc[]>('/doc/recent', {}, workspaceConfig(workspaceId));
}
