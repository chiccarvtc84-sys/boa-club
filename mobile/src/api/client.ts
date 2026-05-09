import { useAuthStore } from '../store/authStore';
import type { AuthTokens } from '../types/models';

/**
 * Base URL de l'API Boa Club.
 *
 * - En dev web (Expo --web sur le PC) : http://localhost:8080 fonctionne directement.
 * - En dev mobile (Expo Go sur ton téléphone) : remplace par l'IP locale du PC,
 *   ex `EXPO_PUBLIC_API_URL=http://192.168.1.42:8080`. Le téléphone et le PC doivent
 *   être sur le même Wi-Fi.
 * - En prod : EXPO_PUBLIC_API_URL=https://api.boaclub.fr (ou ce qu'on choisira).
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: string;

  constructor(status: number, code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Si true, n'attache pas le Bearer token (utile pour /auth/login etc.). */
  skipAuth?: boolean;
}

/**
 * Effectue une requête HTTP authentifiée. Tente un refresh + retry une seule fois
 * sur 401. Lance ApiError sur tous les autres échecs.
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const tokens = useAuthStore.getState().tokens;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (!opts.skipAuth && tokens) {
    headers.Authorization = `Bearer ${tokens.access_token}`;
  }

  const response = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  // 401 + on a un refresh token → on tente une rotation et un seul retry.
  if (response.status === 401 && !opts.skipAuth && tokens?.refresh_token) {
    const newTokens = await tryRefresh(tokens.refresh_token);
    if (newTokens) {
      const retry = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: { ...headers, Authorization: `Bearer ${newTokens.access_token}` },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      return parseResponse<T>(retry);
    }
    // Refresh KO : déconnexion forcée, l'utilisateur est ramené au login.
    await useAuthStore.getState().clearSession();
  }

  return parseResponse<T>(response);
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Réponse non-JSON inattendue.
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `http_${res.status}`, data?.detail);
  }
  return data as T;
}

/**
 * Tente un refresh. Si succès, persiste les nouveaux tokens dans authStore et
 * retourne les nouveaux tokens. Sinon, retourne null.
 */
async function tryRefresh(refreshToken: string): Promise<AuthTokens | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AuthTokens;
    await useAuthStore.getState().setTokens(data);
    return data;
  } catch {
    return null;
  }
}
