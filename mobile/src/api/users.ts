import { apiRequest } from './client';
import type { Belt } from '../types/models';

/** Fiche minimale renvoyée par la recherche (pas d'email). */
export interface UserSearchResultDTO {
  id: string;
  first_name: string;
  last_name_initial: string;
  avatar_url?: string | null;
  belt: Belt;
  stripes: number;
  role: 'member' | 'coach' | 'admin';
}

/** Fiche détaillée d'un autre membre (poids respecte weight_visibility). */
export interface PublicProfileDTO {
  id: string;
  first_name: string;
  last_name_initial: string;
  avatar_url?: string | null;
  bio?: string | null;
  belt: Belt;
  stripes: number;
  weight_kg?: number | null;
  disciplines: string[];
  role: 'member' | 'coach' | 'admin';
  joined_at: string;
  last_login_at?: string | null;
  /** Si false, le client doit empêcher le tap-to-zoom de la photo. */
  allow_photo_zoom: boolean;
}

export const usersApi = {
  search: (q: string, limit = 30) => {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return apiRequest<{ users: UserSearchResultDTO[] }>(
      `/api/users/search?${qs.toString()}`,
    );
  },
  getPublic: (userID: string) =>
    apiRequest<PublicProfileDTO>(`/api/users/${userID}`),
};
