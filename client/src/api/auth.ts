import { apiPost } from './client';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface MeUser extends AuthUser {
  avatarUrl: string | null;
}

export interface RegisteredUser {
  id: string;
  username: string;
  name: string;
}

export function login(username: string, password: string): Promise<AuthUser> {
  return apiPost<AuthUser>('/auth/login', { username, password });
}

export function register(username: string, password: string, name?: string): Promise<RegisteredUser> {
  return apiPost<RegisteredUser>('/auth/register', { username, password, name });
}

export function logout(): Promise<boolean> {
  return apiPost<boolean>('/auth/logout');
}

export function fetchMe(): Promise<MeUser> {
  return apiPost<MeUser>('/users/me');
}
