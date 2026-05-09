import { apiRequest } from './client';
import type { Belt, User, WeightVisibility } from '../types/models';

/** Tous les champs sont optionnels (PATCH partiel). */
export interface UpdateMeParams {
  first_name?: string;
  last_name_initial?: string;
  bio?: string;
  belt?: Belt;
  stripes?: number;
  weight_kg?: number;
  weight_visibility?: WeightVisibility;
  disciplines?: string[];
  avatar_url?: string;
}

export const meApi = {
  get: () => apiRequest<User>('/api/me'),
  update: (params: UpdateMeParams) =>
    apiRequest<User>('/api/me', { method: 'PATCH', body: params }),
  getFollowings: () =>
    apiRequest<{ course_keys: string[] }>('/api/me/course-followings'),
  setFollowings: (course_keys: string[]) =>
    apiRequest<{ course_keys: string[] }>('/api/me/course-followings', {
      method: 'PUT',
      body: { course_keys },
    }),
  setFCMToken: (token: string) =>
    apiRequest<void>('/api/me/fcm-token', { method: 'POST', body: { token } }),
  clearFCMToken: () =>
    apiRequest<void>('/api/me/fcm-token', { method: 'DELETE' }),
  deleteAccount: (password: string) =>
    apiRequest<void>('/api/me', { method: 'DELETE', body: { password } }),
};
