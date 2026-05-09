import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { AuthTokens, User } from '../types/models';

const STORAGE_KEY = 'boa.auth.v1';

interface PersistedSession {
  user: User;
  tokens: AuthTokens;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setSession: (user: User, tokens: AuthTokens) => Promise<void>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession;
        set({ user: parsed.user, tokens: parsed.tokens });
      }
    } catch (e) {
      // Stockage corrompu : on repart de zéro plutôt que de planter le démarrage.
      await AsyncStorage.removeItem(STORAGE_KEY);
    } finally {
      set({ hydrated: true });
    }
  },

  setSession: async (user, tokens) => {
    const session: PersistedSession = { user, tokens };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set({ user, tokens });
  },

  setTokens: async (tokens) => {
    const user = get().user;
    if (!user) return;
    const session: PersistedSession = { user, tokens };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set({ tokens });
  },

  setUser: async (user) => {
    const tokens = get().tokens;
    if (!tokens) return;
    const session: PersistedSession = { user, tokens };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set({ user });
  },

  clearSession: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ user: null, tokens: null });
  },
}));
