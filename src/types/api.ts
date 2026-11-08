import { BabalawoProfile } from './babalawo';
import { Session } from '@supabase/supabase-js';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AuthResponse {
  session: Session | null;
  user: Session['user'] | null;
}

export interface BabalawoListResponse extends PaginatedResponse<BabalawoProfile> {}

export interface SessionListResponse extends PaginatedResponse<Session> {}
