import type { MeUser } from './auth';
import { apiPost, apiPostVoid } from './client';

export function updateProfile(input: { name: string; avatarUrl: string | null }): Promise<MeUser> {
  return apiPost<MeUser>('/users/profile', input);
}

export function changePassword(input: { oldPassword: string; newPassword: string }): Promise<void> {
  return apiPostVoid('/auth/password', input);
}
