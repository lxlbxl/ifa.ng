export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_email_settings: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_encrypted: boolean | null
          setting_key: string
          setting_value: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_encrypted?: boolean | null
          setting_key: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_encrypted?: boolean | null
          setting_key?: string
          setting_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      availability: {
        Row: {
          babalawo_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
        }
        Insert: {
          babalawo_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
        }
        Update: {
          babalawo_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
        }
        Relationships: []
      }
      babalawo_bank_details: {
        Row: {
          account_name: string
          account_number: string
          babalawo_id: string
          bank_name: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          babalawo_id: string
          bank_name: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          babalawo_id?: string
          bank_name?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      babalawo_wallets: {
        Row: {
          available_balance: number
          babalawo_id: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          available_balance?: number
          babalawo_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          available_balance?: number
          babalawo_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      babalawos: {
        Row: {
          availability: Json | null
          bio: string | null
          city: string | null
          commission_babalawo_percent: number | null
          commission_platform_percent: number | null
          country: string | null
          created_at: string
          current_status: string | null
          experience_years: number | null
          hourly_rate: number | null
          id: number
          is_active: boolean | null
          is_featured: boolean | null
          is_verified: boolean
          languages: string[] | null
          profile_picture_url: string | null
          rating: number | null
          region: string | null
          specialties: string[] | null
          timezone: string | null
          total_sessions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: Json | null
          bio?: string | null
          city?: string | null
          commission_babalawo_percent?: number | null
          commission_platform_percent?: number | null
          country?: string | null
          created_at?: string
          current_status?: string | null
          experience_years?: number | null
          hourly_rate?: number | null
          id?: never
          is_active?: boolean | null
          is_featured?: boolean | null
          is_verified?: boolean
          languages?: string[] | null
          profile_picture_url?: string | null
          rating?: number | null
          region?: string | null
          specialties?: string[] | null
          timezone?: string | null
          total_sessions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: Json | null
          bio?: string | null
          city?: string | null
          commission_babalawo_percent?: number | null
          commission_platform_percent?: number | null
          country?: string | null
          created_at?: string
          current_status?: string | null
          experience_years?: number | null
          hourly_rate?: number | null
          id?: never
          is_active?: boolean | null
          is_featured?: boolean | null
          is_verified?: boolean
          languages?: string[] | null
          profile_picture_url?: string | null
          rating?: number | null
          region?: string | null
          specialties?: string[] | null
          timezone?: string | null
          total_sessions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          timestamp: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          timestamp?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          timestamp?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          babalawo_amount: number | null
          commission_amount: number | null
          created_at: string | null
          id: string
          payment_gateway: string | null
          payment_reference: string | null
          session_id: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          babalawo_amount?: number | null
          commission_amount?: number | null
          created_at?: string | null
          id?: string
          payment_gateway?: string | null
          payment_reference?: string | null
          session_id?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          babalawo_amount?: number | null
          commission_amount?: number | null
          created_at?: string | null
          id?: string
          payment_gateway?: string | null
          payment_reference?: string | null
          session_id?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          babalawo_id: string
          created_at: string | null
          id: string
          method: string | null
          reference: string | null
          status: string | null
        }
        Insert: {
          amount: number
          babalawo_id: string
          created_at?: string | null
          id?: string
          method?: string | null
          reference?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          babalawo_id?: string
          created_at?: string | null
          id?: string
          method?: string | null
          reference?: string | null
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          flutterwave_refund_id: string | null
          id: string
          payment_id: string
          processed_by: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          flutterwave_refund_id?: string | null
          id?: string
          payment_id: string
          processed_by?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          flutterwave_refund_id?: string | null
          id?: string
          payment_id?: string
          processed_by?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_completed: boolean | null
          reminder_date: string
          reminder_type: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          reminder_date: string
          reminder_type: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          reminder_date?: string
          reminder_type?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          babalawo_id: string | null
          comment: string | null
          created_at: string
          id: number
          is_approved: boolean
          rating: number
          session_id: number
          user_id: string
        }
        Insert: {
          babalawo_id?: string | null
          comment?: string | null
          created_at?: string
          id?: never
          is_approved?: boolean
          rating: number
          session_id: number
          user_id: string
        }
        Update: {
          babalawo_id?: string | null
          comment?: string | null
          created_at?: string
          id?: never
          is_approved?: boolean
          rating?: number
          session_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ritual_reminders: {
        Row: {
          babalawo_id: number
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          reminder_days: number[] | null
          ritual_type: string
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          babalawo_id: number
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          reminder_days?: number[] | null
          ritual_type: string
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          babalawo_id?: number
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          reminder_days?: number[] | null
          ritual_type?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritual_reminders_babalawo_id_fkey"
            columns: ["babalawo_id"]
            isOneToOne: false
            referencedRelation: "babalawos"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          action: string
          id: string
          metadata: Json | null
          session_id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action: string
          id?: string
          metadata?: Json | null
          session_id: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          agora_channel_name: string | null
          amount: number | null
          babalawo_id: string
          deadline: string | null
          end_time: string
          id: number
          is_instant: boolean | null
          items_needed: string | null
          next_appointment: string | null
          notes: string | null
          other_odus: string | null
          payment_reference: string | null
          payment_status: string | null
          primary_odu: string | null
          ritual_recommendations: string | null
          room_url: string | null
          session_date: string
          start_time: string
          status: Database["public"]["Enums"]["session_status_enum"]
          user_id: string
          user_timezone: string | null
          warning: string | null
        }
        Insert: {
          agora_channel_name?: string | null
          amount?: number | null
          babalawo_id: string
          deadline?: string | null
          end_time: string
          id?: never
          is_instant?: boolean | null
          items_needed?: string | null
          next_appointment?: string | null
          notes?: string | null
          other_odus?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          primary_odu?: string | null
          ritual_recommendations?: string | null
          room_url?: string | null
          session_date: string
          start_time: string
          status: Database["public"]["Enums"]["session_status_enum"]
          user_id: string
          user_timezone?: string | null
          warning?: string | null
        }
        Update: {
          agora_channel_name?: string | null
          amount?: number | null
          babalawo_id?: string
          deadline?: string | null
          end_time?: string
          id?: never
          is_instant?: boolean | null
          items_needed?: string | null
          next_appointment?: string | null
          notes?: string | null
          other_odus?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          primary_odu?: string | null
          ritual_recommendations?: string | null
          room_url?: string | null
          session_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["session_status_enum"]
          user_id?: string
          user_timezone?: string | null
          warning?: string | null
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string | null
          email: boolean | null
          id: string
          new_babalawos: boolean | null
          payment_updates: boolean | null
          session_reminders: boolean | null
          sms: boolean | null
          system_announcements: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: boolean | null
          id?: string
          new_babalawos?: boolean | null
          payment_updates?: boolean | null
          session_reminders?: boolean | null
          sms?: boolean | null
          system_announcements?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: boolean | null
          id?: string
          new_babalawos?: boolean | null
          payment_updates?: boolean | null
          session_reminders?: boolean | null
          sms?: boolean | null
          system_announcements?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          payment_gateway: string | null
          payment_reference: string | null
          session_id: string | null
          transaction_source: string
          transaction_type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          payment_gateway?: string | null
          payment_reference?: string | null
          session_id?: string | null
          transaction_source: string
          transaction_type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          payment_gateway?: string | null
          payment_reference?: string | null
          session_id?: string | null
          transaction_source?: string
          transaction_type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          babalawo_id: string
          created_at: string | null
          id: string
          reason: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          babalawo_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          babalawo_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_complete_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      coalesce_zero: {
        Args: { val: unknown }
        Returns: unknown
      }
      get_babalawo_details_by_ids: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          full_name: string
          avatar_url: string
          specialties: string[]
        }[]
      }
      get_babalawo_earnings_stats: {
        Args: { p_babalawo_id: string }
        Returns: Json
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
          verification_status: string
          rating: number
          total_sessions: number
          languages: string[]
          timezone: string
          is_active: boolean
          is_featured: boolean
          current_status: string
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      update_wallet_balance: {
        Args: {
          p_user_id: string
          p_amount: number
          p_transaction_type: string
          p_transaction_source: string
          p_payment_gateway?: string
          p_payment_reference?: string
          p_session_id?: string
          p_description?: string
        }
        Returns: string
      }
    }
    Enums: {
      payment_status: "pending" | "paid" | "failed" | "refunded"
      session_status: "pending" | "confirmed" | "completed" | "cancelled"
      session_status_enum:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "in_progress"
      user_role: "user" | "babalawo" | "admin"
      verification_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      payment_status: ["pending", "paid", "failed", "refunded"],
      session_status: ["pending", "confirmed", "completed", "cancelled"],
      session_status_enum: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "in_progress",
      ],
      user_role: ["user", "babalawo", "admin"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
