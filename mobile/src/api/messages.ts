import { apiRequest } from './client';
import type { Belt } from '../types/models';
import type { UserBriefDTO } from './freeSlots';

export type ConversationType = 'direct' | 'slot_thread';
export type MessageType = 'text' | 'photo' | 'voice' | 'system';

export interface ConversationSummaryDTO {
  id: string;
  type: ConversationType;
  slot_id?: string;
  slot_title?: string;
  other?: UserBriefDTO; // Pour DM
  last_message_at?: string;
  last_message?: string;
  last_message_type?: MessageType;
  unread_count: number;
}

export interface MessageDTO {
  id: string;
  conversation_id: string;
  sender?: UserBriefDTO; // null pour 'system'
  type: MessageType;
  content?: string;
  media_url?: string;
  media_duration_seconds?: number;
  created_at: string;
  reactions?: MessageReactionDTO[];
}

export interface MessageReactionDTO {
  emoji: string;
  count: number;
  has_mine: boolean;
}

export interface MessageSearchHitDTO {
  message: MessageDTO;
  conversation_title?: string;
  conversation_type: 'direct' | 'slot_thread';
  other?: UserBriefDTO;
}

export const messagesApi = {
  listDMs: () =>
    apiRequest<{ conversations: ConversationSummaryDTO[] }>('/api/conversations'),
  openDM: (user_id: string) =>
    apiRequest<{ conversation_id: string }>('/api/conversations/dm', {
      method: 'POST',
      body: { user_id },
    }),
  listMessages: (convID: string, before?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (before) params.set('before', before);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return apiRequest<{ messages: MessageDTO[] }>(
      `/api/conversations/${convID}/messages${qs ? '?' + qs : ''}`,
    );
  },
  send: (convID: string, content: string) =>
    apiRequest<MessageDTO>(`/api/conversations/${convID}/messages`, {
      method: 'POST',
      body: { content },
    }),
  /** Envoi d'une photo (URL R2 déjà uploadée via uploads.ts). */
  sendPhoto: (convID: string, mediaURL: string) =>
    apiRequest<MessageDTO>(`/api/conversations/${convID}/messages`, {
      method: 'POST',
      body: { type: 'photo', media_url: mediaURL },
    }),
  /** Envoi d'une note vocale (URL R2 + durée en secondes). */
  sendVoice: (convID: string, mediaURL: string, durationSeconds: number) =>
    apiRequest<MessageDTO>(`/api/conversations/${convID}/messages`, {
      method: 'POST',
      body: {
        type: 'voice',
        media_url: mediaURL,
        media_duration_seconds: durationSeconds,
      },
    }),
  markRead: (convID: string) =>
    apiRequest<void>(`/api/conversations/${convID}/read`, { method: 'POST' }),
  slotThread: (slotID: string) =>
    apiRequest<{ conversation_id: string; slot_id: string }>(
      `/api/free-slots/${slotID}/thread`,
    ),

  // ─── Mute / Unmute ───────────────────────────────────────────
  /** Mute jusqu'à une date donnée (ISO). Pour mute "indéfini", envoyer 9999-12-31T23:59:59Z. */
  mute: (convID: string, until: string) =>
    apiRequest<void>(`/api/conversations/${convID}/mute`, {
      method: 'POST',
      body: { until },
    }),
  unmute: (convID: string) =>
    apiRequest<void>(`/api/conversations/${convID}/mute`, { method: 'DELETE' }),

  // ─── Réactions emoji ─────────────────────────────────────────
  addReaction: (convID: string, msgID: string, emoji: string) =>
    apiRequest<void>(`/api/conversations/${convID}/messages/${msgID}/reactions`, {
      method: 'POST',
      body: { emoji },
    }),
  removeReaction: (convID: string, msgID: string, emoji: string) =>
    apiRequest<void>(
      `/api/conversations/${convID}/messages/${msgID}/reactions?emoji=${encodeURIComponent(emoji)}`,
      { method: 'DELETE' },
    ),

  // ─── Recherche FTS ───────────────────────────────────────────
  search: (query: string, limit = 30) => {
    const qs = new URLSearchParams({ q: query, limit: String(limit) });
    return apiRequest<{ hits: MessageSearchHitDTO[] }>(
      `/api/messages/search?${qs.toString()}`,
    );
  },
};
