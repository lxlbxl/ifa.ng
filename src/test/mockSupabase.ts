import { vi } from 'vitest';

/**
 * Mock Supabase client for unit testing
 * Use this in tests instead of the real Supabase client
 */
export const createMockSupabaseClient = () => {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        in: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        in: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signUp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        download: vi.fn(() => Promise.resolve({ data: null, error: null })),
        remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      })),
      listBuckets: vi.fn(() => Promise.resolve({ data: [], error: null })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
};

/**
 * Mock session data for testing
 */
export const mockSession = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  user_id: '123e4567-e89b-12d3-a456-426614174001',
  babalawo_id: '123e4567-e89b-12d3-a456-426614174002',
  session_date: '2026-02-01',
  start_time: '10:00:00',
  end_time: '11:00:00',
  status: 'pending' as const,
  amount: 15000,
  payment_status: 'pending' as const,
  is_instant: false,
  agora_channel_name: null,
  room_url: null,
  notes: null,
  primary_odu: null,
  other_odus: null,
  ritual_recommendations: null,
  items_needed: null,
  deadline: null,
  next_appointment: null,
  user_timezone: 'Africa/Lagos',
};

/**
 * Mock babalawo data for testing
 */
export const mockBabalawo = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  full_name: 'Test Babalawo',
  avatar_url: 'https://example.com/avatar.jpg',
  specialties: ['Divination', 'Spiritual Guidance'],
  experience_years: 10,
  hourly_rate: 15000,
  bio: 'Experienced spiritual guide',
  verification_status: 'approved',
  rating: 4.8,
  total_sessions: 150,
  languages: ['English', 'Yoruba'],
  timezone: 'Africa/Lagos',
  is_active: true,
  is_featured: false,
  current_status: 'online' as const,
};

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  email: 'test@example.com',
  role: 'user' as const,
  created_at: '2026-01-01T00:00:00Z',
};

/**
 * Mock profile data for testing
 */
export const mockProfile = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  full_name: 'Test User',
  avatar_url: null,
  phone_number: '+2341234567890',
  date_of_birth: null,
  location: 'Lagos, Nigeria',
  role: 'user' as const,
  wallet_balance: 5000,
};
