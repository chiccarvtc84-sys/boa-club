import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { meApi } from '../api/me';

const STORAGE_KEY = 'boa.notifications.v1';

/** Tous les cours du club, suivis par défaut à la 1ère ouverture. */
const DEFAULT_FOLLOWED: string[] = [
  'jjb-gi',
  'grappling-debutant',
  'grappling-confirme',
  'mma',
  'open-mat',
  'free-slot-joined',
];

interface NotificationsState {
  followed: Set<string>;
  hydrated: boolean;

  /** Charge depuis AsyncStorage (rapide, pour le 1er render). */
  hydrate: () => Promise<void>;
  /** Sync avec le backend après login (source de vérité). */
  syncFromServer: () => Promise<void>;
  toggle: (courseKey: string) => void;
  /** Sauve localement + push au backend si on a une session. */
  save: () => Promise<void>;
  isFollowed: (courseKey: string) => boolean;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  followed: new Set(DEFAULT_FOLLOWED),
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        set({ followed: new Set(arr), hydrated: true });
        return;
      }
    } catch {
      // ignore : on garde les défauts.
    }
    set({ hydrated: true });
  },

  syncFromServer: async () => {
    try {
      const { course_keys } = await meApi.getFollowings();
      // Si le serveur n'a rien (premier login après création de compte), on garde
      // les valeurs par défaut (tous les cours suivis) et on les pushe.
      if (course_keys.length > 0) {
        set({ followed: new Set(course_keys) });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(course_keys));
      } else {
        const local = Array.from(get().followed);
        await meApi.setFollowings(local);
      }
    } catch {
      // Offline ou pas de session : on garde l'état local.
    }
  },

  toggle: (courseKey) => {
    const next = new Set(get().followed);
    if (next.has(courseKey)) next.delete(courseKey);
    else next.add(courseKey);
    set({ followed: next });
  },

  save: async () => {
    const arr = Array.from(get().followed);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    try {
      await meApi.setFollowings(arr);
    } catch {
      // Offline : la sync se refera au prochain syncFromServer().
    }
  },

  isFollowed: (courseKey) => get().followed.has(courseKey),
}));
