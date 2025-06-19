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
      babalawos: {
        Row: {
          bio: string | null
          created_at: string | null
          experience_years: number | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          languages: string[] | null
          rating: number | null
          specialties: string[] | null
          timezone: string | null
          total_sessions: number | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          experience_years?: number | null
          hourly_rate?: number | null
          id: string
          is_active?: boolean | null
          languages?: string[] | null
          rating?: number | null
          specialties?: string[] | null
          timezone?: string | null
          total_sessions?: number | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          experience_years?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          languages?: string[] | null
          rating?: number | null
          specialties?: string[] | null
          timezone?: string | null
          total_sessions?: number | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_commission: number
          amount: number
          babalawo_id: string
          babalawo_share: number
          created_at: string
          currency: string
          flutterwave_reference: string | null
          flutterwave_transaction_id: string | null
          id: string
          payment_method: string | null
          paystack_reference: string | null
          paystack_transaction_id: string | null
          selected_payment_method: string | null
          session_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_commission?: number
          amount: number
          babalawo_id: string
          babalawo_share?: number
          created_at?: string
          currency?: string
          flutterwave_reference?: string | null
          flutterwave_transaction_id?: string | null
          id?: string
          payment_method?: string | null
          paystack_reference?: string | null
          paystack_transaction_id?: string | null
          selected_payment_method?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_commission?: number
          amount?: number
          babalawo_id?: string
          babalawo_share?: number
          created_at?: string
          currency?: string
          flutterwave_reference?: string | null
          flutterwave_transaction_id?: string | null
          id?: string
          payment_method?: string | null
          paystack_reference?: string | null
          paystack_transaction_id?: string | null
          selected_payment_method?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_babalawo_id_fkey"
            columns: ["babalawo_id"]
            isOneToOne: false
            referencedRelation: "babalawos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          babalawo_id: string
          bank_details: Json | null
          created_at: string
          id: string
          payment_method: string | null
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          babalawo_id: string
          bank_details?: Json | null
          created_at?: string
          id?: string
          payment_method?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          babalawo_id?: string
          bank_details?: Json | null
          created_at?: string
          id?: string
          payment_method?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_babalawo_id_fkey"
            columns: ["babalawo_id"]
            isOneToOne: false
            referencedRelation: "babalawos"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          babalawo_id: string
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          session_id: string
          user_id: string
        }
        Insert: {
          babalawo_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          session_id: string
          user_id: string
        }
        Update: {
          babalawo_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          session_id?: string
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
        Relationships: [
          {
            foreignKeyName: "session_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          agora_channel_name: string | null
          agora_token_babalawo: string | null
          agora_token_user: string | null
          amount: number
          babalawo_id: string
          created_at: string | null
          end_time: string
          id: string
          jitsi_room_name: string | null
          notes: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          session_date: string
          session_ended_at: string | null
          session_started_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agora_channel_name?: string | null
          agora_token_babalawo?: string | null
          agora_token_user?: string | null
          amount: number
          babalawo_id: string
          created_at?: string | null
          end_time: string
          id?: string
          jitsi_room_name?: string | null
          notes?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          session_date: string
          session_ended_at?: string | null
          session_started_at?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["session_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agora_channel_name?: string | null
          agora_token_babalawo?: string | null
          agora_token_user?: string | null
          amount?: number
          babalawo_id?: string
          created_at?: string | null
          end_time?: string
          id?: string
          jitsi_room_name?: string | null
          notes?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          session_date?: string
          session_ended_at?: string | null
          session_started_at?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["session_status"] | null
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
            foreignKeyName: "wallet_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      user_role: "user" | "babalawo" | "admin"
      verification_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      payment_status: ["pending", "paid", "failed", "refunded"],
      session_status: ["pending", "confirmed", "completed", "cancelled"],
      user_role: ["user", "babalawo", "admin"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
