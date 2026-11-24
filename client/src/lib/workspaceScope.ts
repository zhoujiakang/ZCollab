import { AxiosHeaders, type AxiosRequestConfig, type RawAxiosHeaders } from 'axios';

export function workspaceIdFromPath(pathname: string): string | undefined {
  return /^\/w\/([1-9]\d*)(?:\/|$)/.exec(pathname)?.[1];
}

/** Explicit IDs pin delayed work to its originating workspace across navigation. */
export function workspaceConfig(workspaceId?: string | null) {
  if (workspaceId === null) return { headers: { 'X-Workspace-Id': false as const } };
  return workspaceId ? { headers: { 'X-Workspace-Id': workspaceId } } : {};
}

export function scopeWorkspaceRequest(pathname: string, config?: AxiosRequestConfig): AxiosRequestConfig {
  const headers = new AxiosHeaders(config?.headers as RawAxiosHeaders | undefined);
  const workspaceId = workspaceIdFromPath(pathname);
  if (workspaceId && !headers.has('X-Workspace-Id')) headers.set('X-Workspace-Id', workspaceId);
  return { ...config, headers };
}
