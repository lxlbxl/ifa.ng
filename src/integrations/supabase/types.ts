export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_encrypted: boolean | null
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_encrypted?: boolean | null
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_encrypted?: boolean | null
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      availability: {
        Row: {
          babalawo_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
        }
        Insert: {
          babalawo_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
        }
        Update: {
          babalawo_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_babalawo_id_fkey"
            columns: ["babalawo_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      babalawo_bank_details: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "babalawo_bank_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      babalawo_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_updated: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_updated?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_updated?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "babalawo_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      babalawos: {
        Row: {
          bio: string | null
          created_at: string
          experience_years: number | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          languages: string[] | null
          rating: number | null
          specialties: string[] | null
          timezone: string | null
          total_sessions: number | null
          updated_at: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          experience_years?: number | null
          hourly_rate?: number | null
          id: string
          is_active?: boolean | null
          languages?: string[] | null
          rating?: number | null
          specialties?: string[] | null
          timezone?: string | null
          total_sessions?: number | null
          updated_at?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          experience_years?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          languages?: string[] | null
          rating?: number | null
          specialties?: string[] | null
          timezone?: string | null
          total_sessions?: number | null
          updated_at?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "babalawos_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          babalawo_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          session_id: string
          user_id: string
        }
        Insert: {
          babalawo_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          session_id: string
          user_id: string
        }
        Update: {
          babalawo_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_babalawo_id_fkey"
            columns: ["babalawo_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          amount: number
          babalawo_id: string
          consultation_outcome: Json | null
          created_at: string
          deadline: string | null
          end_time: string
          id: string
          items_needed: string[] | null
          jitsi_room_name: string | null
          next_appointment: string | null
          notes: string | null
          other_odus: string[] | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          primary_odu: string | null
          ritual_recommendations: string | null
          session_date: string
          start_time: string
          status: Database["public"]["Enums"]["session_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          babalawo_id: string
          consultation_outcome?: Json | null
          created_at?: string
          deadline?: string | null
          end_time: string
          id?: string
          items_needed?: string[] | null
          jitsi_room_name?: string | null
          next_appointment?: string | null
          notes?: string | null
          other_odus?: string[] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          primary_odu?: string | null
          ritual_recommendations?: string | null
          session_date: string
          start_time: string
          status?: Database["public"]["Enums"]["session_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          babalawo_id?: string
          consultation_outcome?: Json | null
          created_at?: string
          deadline?: string | null
          end_time?: string
          id?: string
          items_needed?: string[] | null
          jitsi_room_name?: string | null
          next_appointment?: string | null
          other_odus?: string[] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          primary_odu?: string | null
          ritual_recommendations?: string | null
          session_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["session_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_babalawo_id_fkey"
            columns: ["babalawo_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_updated: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_updated?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_updated?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          approved_at: string | null
          bank_details_id: string
          created_at: string
          id: string
          processed_at: string | null
          processor_reference: string | null
          rejection_reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          bank_details_id: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processor_reference?: string | null
          rejection_reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          bank_details_id?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processor_reference?: string | null
          rejection_reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_bank_details_id_fkey"
            columns: ["bank_details_id"]
            isOneToOne: false
            referencedRelation: "babalawo_bank_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_babalawo_details_by_ids: {
        Args: {
          p_ids: string[]
        }
        Returns: {
          id: string
          full_name: string
          avatar_url: string
          specialties: string[]
        }[]
      }
      get_public_babalawos: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          full_name: string
          avatar_url: string
          specialties: string[]
          experience_years: number
          hourly_rate: number
          bio: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          rating: number
          total_sessions: number
          languages: string[]
          timezone: string
          is_active: boolean
        }[]
      }
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: {
          [key: string]: unknown
        }
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      update_babalawo_rating: {
        Args: Record<PropertyKey, never>
        Returns: {
          [key: string]: unknown
        }
      }
      update_wallet_balance: {
        Args: {
          p_user_id: string
          p_amount: number
        }
        Returns: undefined
      }
    }
    Enums: {
      payment_status: "pending" | "paid" | "failed" | "refunded"
      session_status: "pending" | "confirmed" | "completed" | "cancelled"
      user_role: "user" | "babalawo" | "admin"
      verification_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
