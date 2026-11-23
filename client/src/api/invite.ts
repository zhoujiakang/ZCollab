import { apiGet } from './client';

export interface PublicInvite {
  workspaceName: string;
  inviterName: string | null;
  memberCount: number;
  expiresAt: string | null;
}

export function getPublicInvite(token: string): Promise<PublicInvite> {
  return apiGet<PublicInvite>(`/public/invite/${encodeURIComponent(token)}`);
}
