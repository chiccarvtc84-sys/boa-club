import { apiRequest } from './client';

export interface BroadcastDTO {
  id: string;
  author_user_id: string;
  author_display_name: string;
  message: string;
  duration_hours: number;
  created_at: string;
  expires_at: string;
}

export interface CreateBroadcastPayload {
  display_name: string;
  message: string;
  duration_hours: number;
}

export interface NotifyCoursePayload {
  date: string;             // "2026-05-06"
  type: 'late' | 'absent';
  minutes_late?: number;    // requis si type=late
  cancelled?: boolean;      // si type=absent
  message?: string;
}

export interface UpdateCoursePayload {
  default_coach_id?: string;
  start_time?: string; // "18:30"
  end_time?: string;
  location?: string;
  discipline?: 'jjb_gi' | 'jjb_nogi' | 'mma' | 'wrestling' | 'open_mat' | 'mixed';
  intensity?: 'technique' | 'drilling' | 'sparring_light' | 'sparring_hard' | 'all_levels';
  is_active?: boolean;
}

export interface CoachDTO {
  id: string;
  first_name: string;
  last_name_initial: string;
  belt: string;
  stripes: number;
  avatar_url: string | null;
  is_coach: boolean;
}

/** Fiche membre dans le dashboard admin (plus complet que UserBriefDTO). */
export interface AdminUserSummaryDTO {
  id: string;
  email: string;
  first_name: string;
  last_name_initial: string;
  belt: string;
  stripes: number;
  avatar_url?: string | null;
  role: 'member' | 'coach' | 'admin';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  created_at: string;
  last_login_at?: string | null;
}

export interface AdminListUsersFilters {
  q?: string;       // recherche partielle email + prénom
  role?: 'member' | 'coach' | 'admin';
  status?: 'pending' | 'active' | 'suspended';
}

export const adminApi = {
  createBroadcast: (payload: CreateBroadcastPayload) =>
    apiRequest<BroadcastDTO>('/api/admin/broadcasts', { method: 'POST', body: payload }),
  revokeBroadcast: (id: string) =>
    apiRequest<void>(`/api/admin/broadcasts/${id}`, { method: 'DELETE' }),
  notifyCourse: (courseId: string, payload: NotifyCoursePayload) =>
    apiRequest<void>(`/api/admin/courses/${courseId}/notify`, { method: 'POST', body: payload }),
  updateCourse: (courseId: string, payload: UpdateCoursePayload) =>
    apiRequest<void>(`/api/admin/courses/${courseId}`, { method: 'PATCH', body: payload }),
  listCoaches: () =>
    apiRequest<{ coaches: CoachDTO[] }>('/api/admin/coaches'),

  // ─── Gestion des membres (admins uniquement) ───────────────
  listUsers: (filters: AdminListUsersFilters = {}) => {
    const qs = new URLSearchParams();
    if (filters.q) qs.set('q', filters.q);
    if (filters.role) qs.set('role', filters.role);
    if (filters.status) qs.set('status', filters.status);
    const path = qs.toString() ? `/api/admin/users?${qs.toString()}` : '/api/admin/users';
    return apiRequest<{ users: AdminUserSummaryDTO[] }>(path);
  },
  updateUser: (
    userID: string,
    payload: { role?: 'member' | 'coach' | 'admin'; status?: 'pending' | 'active' | 'suspended' },
  ) =>
    apiRequest<AdminUserSummaryDTO>(`/api/admin/users/${userID}`, {
      method: 'PATCH',
      body: payload,
    }),
};

export const broadcastsApi = {
  active: () => apiRequest<{ broadcasts: BroadcastDTO[] }>('/api/broadcasts/active'),
  dismiss: (id: string) =>
    apiRequest<void>(`/api/broadcasts/${id}/dismiss`, { method: 'POST' }),
};
