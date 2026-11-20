import { apiPost } from './client';
import type { PageParams, PageResponse, WorkspaceSummary } from './workspace';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
}

export interface MeUser extends AuthUser {
  avatarUrl: string | null;
  activeWorkspace: WorkspaceSummary | null;
  workspaces: PageResponse<WorkspaceSummary>;
}

export interface RegisteredUser {
  id: string;
  username: string;
  name: string;
}

export function login(username: string, password: string): Promise<AuthUser> {
  return apiPost<AuthUser>('/auth/login', { username, password });
}

export function register(username: string, password: string, name: string): Promise<RegisteredUser> {
  return apiPost<RegisteredUser>('/auth/register', { username, password, name });
}

export function logout(): Promise<void> {
  return apiPost<void>('/auth/logout');
}

export function fetchMe(params: PageParams = {}): Promise<MeUser> {
  return apiPost<MeUser>('/users/me', params);
}
