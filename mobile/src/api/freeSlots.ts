import { apiRequest } from './client';
import type { CourseDiscipline } from './courses';
import type { Belt } from '../types/models';

export type SlotIntensity =
  | 'technique'
  | 'drilling'
  | 'sparring_light'
  | 'sparring_hard'
  | 'all_levels';

export interface UserBriefDTO {
  id: string;
  first_name: string;
  last_name_initial: string;
  belt: Belt;
  stripes: number;
  avatar_url: string | null;
  is_coach: boolean;
}

export interface FreeSlotSummaryDTO {
  id: string;
  creator: UserBriefDTO;
  scheduled_start: string; // ISO 8601
  scheduled_end: string;
  title: string;
  description?: string;
  discipline: CourseDiscipline;
  intensity?: SlotIntensity;
  location?: string;
  is_cancelled: boolean;
  participant_count: number;
  created_at: string;
}

export interface FreeSlotDetailDTO extends FreeSlotSummaryDTO {
  participants: UserBriefDTO[];
}

export interface CreateSlotPayload {
  title: string;
  description?: string;
  scheduled_start: string;
  scheduled_end: string;
  discipline: CourseDiscipline;
  intensity?: SlotIntensity;
  location?: string;
}

export const freeSlotsApi = {
  list: () =>
    apiRequest<{ slots: FreeSlotSummaryDTO[] }>('/api/free-slots'),
  get: (id: string) =>
    apiRequest<FreeSlotDetailDTO>(`/api/free-slots/${id}`),
  create: (payload: CreateSlotPayload) =>
    apiRequest<FreeSlotDetailDTO>('/api/free-slots', { method: 'POST', body: payload }),
  join: (id: string) =>
    apiRequest<void>(`/api/free-slots/${id}/join`, { method: 'POST' }),
  leave: (id: string) =>
    apiRequest<void>(`/api/free-slots/${id}/join`, { method: 'DELETE' }),
  cancel: (id: string, reason?: string) =>
    apiRequest<void>(`/api/free-slots/${id}`, {
      method: 'DELETE',
      body: reason ? { reason } : undefined,
    }),
};
