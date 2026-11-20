import { apiPost } from './client';

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
