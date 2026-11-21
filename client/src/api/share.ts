import { apiGet, apiPost, apiPostVoid } from './client';

export interface ShareCreateResult {
  token: string;
  path: string;
}

export interface ShareStatus {
  shared: boolean;
  token: string | null;
}

export interface PublicShareDoc {
  title: string;
  content: string;
  updatedAt: string | null;
}

export function createShareLink(id: string): Promise<ShareCreateResult> {
  return apiPost<ShareCreateResult>('/doc/share/create', { id });
}

export function revokeShareLink(id: string): Promise<void> {
  return apiPostVoid('/doc/share/revoke', { id });
}

export function getShareStatus(id: string): Promise<ShareStatus> {
  return apiPost<ShareStatus>('/doc/share/status', { id });
}

export function getPublicShare(token: string): Promise<PublicShareDoc> {
  return apiGet<PublicShareDoc>(`/public/share/${encodeURIComponent(token)}`);
}
