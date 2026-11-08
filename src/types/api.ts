import { BabalawoProfile } from './babalawo';
import type { AppSession as Session } from '@/integrations/api/auth';

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
