export interface BabalawoProfile {
  id: string;
  full_name: string; // Always present, never null
  avatar_url: string | null;
  specialties: string[] | null;
  experience_years: number | null;
  hourly_rate: number | null;
  bio: string | null;
  verification_status: string | null;
  rating: number | null;
  total_sessions: number | null;
  languages: string[] | null;
  timezone: string | null;
  is_active: boolean | null;
}

export interface SessionWithBabalawo {
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
  other_odus: string[] | null;
  ritual_recommendations: string | null;
  items_needed: string[] | null;
  deadline: string | null;
  next_appointment: string | null;
  warnings: string | null;
  consultation_notes: string | null;
}

export interface BabalawoSearchFilters {
  specialties?: string[];
  minRating?: number;
  maxRate?: number;
  languages?: string[];
  availability?: 'available' | 'busy' | 'offline';
  search_term?: string;
}
