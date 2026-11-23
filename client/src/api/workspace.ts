import { apiPost, apiPostVoid } from './client';

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: string;
}

export interface CreatedWorkspace {
  id: string;
  name: string;
}

export interface WorkspaceInfo extends WorkspaceSummary {
  memberCount: number;
}

export interface Member {
  id: string;
  username: string;
  name: string;
  role: string;
  joinedAt: string;
}

export function createWorkspace(name: string): Promise<CreatedWorkspace> {
  return apiPost<CreatedWorkspace>('/workspace/create', { name });
}

export function switchWorkspace(id: string): Promise<WorkspaceSummary> {
  return apiPost<WorkspaceSummary>('/workspace/switch', { id });
}

export function fetchWorkspaceInfo(): Promise<WorkspaceInfo> {
  return apiPost<WorkspaceInfo>('/workspace/info');
}

export function fetchMembers(params: PageParams = {}): Promise<PageResponse<Member>> {
  return apiPost<PageResponse<Member>>('/workspace/members', params);
}

export function inviteMember(username: string): Promise<Member> {
  return apiPost<Member>('/workspace/members/add', { username });
}

export function removeMember(userId: string): Promise<void> {
  return apiPostVoid('/workspace/members/remove', { userId });
}

export function renameWorkspace(name: string): Promise<WorkspaceInfo> {
  return apiPost<WorkspaceInfo>('/workspace/rename', { name });
}

export function transferOwner(userId: string): Promise<void> {
  return apiPostVoid('/workspace/members/transfer', { userId });
}

export interface Invite {
  id: string;
  token: string;
  path: string;
  createdBy: string;
  creatorName: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function createInvite(expiresInDays: number | null): Promise<Invite> {
  return apiPost<Invite>('/workspace/invites', { expiresInDays });
}

export function fetchInvites(): Promise<Invite[]> {
  return apiPost<Invite[]>('/workspace/invites/list');
}

export function revokeInvite(id: string): Promise<void> {
  return apiPostVoid('/workspace/invites/revoke', { id });
}

export function acceptInvite(token: string): Promise<WorkspaceSummary> {
  return apiPost<WorkspaceSummary>('/workspace/invites/accept', { token });
}
