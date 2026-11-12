export interface BabalawoProfile {
  id: string;
  full_name: string; // Always present, never null
  avatar_url: string | null;
  specialties: string[] | null;
  experience_years: number | null;
  hourly_rate: number | null;
  /** Diaspora prices (USD), set by the admin or derived from the naira price. */
  usd_price?: number | null;
  usd_instant_price?: number | null;
  instant_price?: number | null;
  bio: string | null;
  verification_status: string | null;
  rating: number | null;
  total_sessions: number | null;
  languages: string[] | null;
  timezone: string | null;
  is_active: boolean | null;
  is_featured?: boolean | null;
  current_status?: string | null;
}

export interface SessionWithBabalawo {
  /** consultation, or the live ritual of a paid Ebo (never billed separately) */
  session_type?: string;
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  amount: number;
  notes: string | null;
  babalawo_id: string;
  babalawo_name: string; // Standardized name field
  babalawo_avatar: string | null;
  babalawo_specialties: string[] | null;
  primary_odu: string | null;
  other_odus: string[] | string | null;
  ritual_recommendations: string | null;
  items_needed: string[] | null;
  deadline: string | null;
  next_appointment: string | null;
  warnings: string | null;
  consultation_notes: string | null;
  is_instant?: boolean; // Added this line
}

export interface BabalawoSearchFilters {
  specialties?: string[];
  minRating?: number;
  maxRate?: number;
  languages?: string[];
  availability?: 'available' | 'busy' | 'offline';
  search_term?: string;
}
