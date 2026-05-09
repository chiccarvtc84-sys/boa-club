/**
 * Types côté mobile — calqués sur internal/models/user.go côté backend.
 */

export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black';
export type Role = 'member' | 'coach' | 'admin';
export type Status = 'pending' | 'active' | 'suspended' | 'deleted';
export type WeightVisibility = 'public' | 'members' | 'private';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name_initial: string;
  avatar_url: string | null;
  bio: string | null;
  belt: Belt;
  stripes: number;
  weight_kg: number | null;
  weight_visibility: WeightVisibility;
  disciplines: string[];
  role: Role;
  status: Status;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}
