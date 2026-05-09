import { apiRequest } from './client';
import type { AuthResponse, AuthTokens, User } from '../types/models';

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  email: string;
  password: string;
  first_name: string;
  last_name_initial: string;
}

export const authApi = {
  login: (params: LoginParams) =>
    apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: params, skipAuth: true }),

  register: (params: RegisterParams) =>
    apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: params, skipAuth: true }),

  refresh: (refresh_token: string) =>
    apiRequest<AuthTokens>('/api/auth/refresh', { method: 'POST', body: { refresh_token }, skipAuth: true }),

  logout: (refresh_token: string) =>
    apiRequest<void>('/api/auth/logout', { method: 'POST', body: { refresh_token }, skipAuth: true }),

  forgotPassword: (email: string) =>
    apiRequest<void>('/api/auth/forgot-password', { method: 'POST', body: { email }, skipAuth: true }),

  resetPassword: (code: string, password: string) =>
    apiRequest<void>('/api/auth/reset-password', { method: 'POST', body: { code, password }, skipAuth: true }),

  me: () => apiRequest<User>('/api/me'),
};
