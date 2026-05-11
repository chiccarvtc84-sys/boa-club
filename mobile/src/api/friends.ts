import { apiRequest } from './client';
import type { Belt } from '../types/models';

/** Ligne d'ami dans la liste FriendsScreen. */
export interface FriendDTO {
  id: string;
  first_name: string;
  last_name_initial: string;
  avatar_url?: string | null;
  belt: Belt;
  stripes: number;
  role: 'member' | 'coach' | 'admin';
  notifications_enabled: boolean;
  friends_since: string;
  last_login_at?: string | null;
}

export const friendsApi = {
  list: () => apiRequest<{ friends: FriendDTO[] }>('/api/friends'),
  add: (friendID: string) =>
    apiRequest<void>('/api/friends', {
      method: 'POST',
      body: { friend_id: friendID },
    }),
  remove: (friendID: string) =>
    apiRequest<void>(`/api/friends/${friendID}`, { method: 'DELETE' }),
  setNotifications: (friendID: string, enabled: boolean) =>
    apiRequest<void>(`/api/friends/${friendID}/notifications`, {
      method: 'PATCH',
      body: { enabled },
    }),
};
