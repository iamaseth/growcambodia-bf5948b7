export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      crop_knowledge: {
        Row: {
          created_at: string
          crop_name: string
          diseases: Json
          growing_conditions: string
          id: string
          lifecycle: Json
          region: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crop_name: string
          diseases?: Json
          growing_conditions: string
          id?: string
          lifecycle?: Json
          region?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crop_name?: string
          diseases?: Json
          growing_conditions?: string
          id?: string
          lifecycle?: Json
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      farm_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          farm_id: string
          id: string
          invited_at: string
          invited_by: string | null
          member_role: Database["public"]["Enums"]["farm_member_role"]
          status: Database["public"]["Enums"]["farm_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          farm_id: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          member_role?: Database["public"]["Enums"]["farm_member_role"]
          status?: Database["public"]["Enums"]["farm_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          farm_id?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          member_role?: Database["public"]["Enums"]["farm_member_role"]
          status?: Database["public"]["Enums"]["farm_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_members_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_visits: {
        Row: {
          completed_at: string | null
          created_at: string
          farm_id: string
          id: string
          plant_log_id: string | null
          private_notes: string | null
          purpose: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          visit_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          farm_id: string
          id?: string
          plant_log_id?: string | null
          private_notes?: string | null
          purpose?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          visit_type?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          farm_id?: string
          id?: string
          plant_log_id?: string | null
          private_notes?: string | null
          purpose?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_visits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_visits_plant_log_id_fkey"
            columns: ["plant_log_id"]
            isOneToOne: false
            referencedRelation: "plant_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_submissions: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          image_urls: string[]
          measurement_data: Json
          observations: string | null
          plant_log_id: string | null
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submission_type: Database["public"]["Enums"]["submission_type"]
          submitted_at: string | null
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          image_urls?: string[]
          measurement_data?: Json
          observations?: string | null
          plant_log_id?: string | null
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submission_type?: Database["public"]["Enums"]["submission_type"]
          submitted_at?: string | null
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          image_urls?: string[]
          measurement_data?: Json
          observations?: string | null
          plant_log_id?: string | null
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submission_type?: Database["public"]["Enums"]["submission_type"]
          submitted_at?: string | null
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_submissions_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_submissions_plant_log_id_fkey"
            columns: ["plant_log_id"]
            isOneToOne: false
            referencedRelation: "plant_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          address: string | null
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plant_logs: {
        Row: {
          area_unit: string | null
          area_value: number | null
          created_at: string
          crop_type: string
          estimated_age_years: number | null
          farm_id: string
          id: string
          lat: number | null
          lng: number | null
          planted_at: string | null
          quantity: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
          variety: string | null
        }
        Insert: {
          area_unit?: string | null
          area_value?: number | null
          created_at?: string
          crop_type: string
          estimated_age_years?: number | null
          farm_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          planted_at?: string | null
          quantity?: number | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          variety?: string | null
        }
        Update: {
          area_unit?: string | null
          area_value?: number | null
          created_at?: string
          crop_type?: string
          estimated_age_years?: number | null
          farm_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          planted_at?: string | null
          quantity?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plant_logs_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      timeline_updates: {
        Row: {
          created_at: string
          growth_stage: string
          id: string
          image_urls: string[]
          likes: number
          log_id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          growth_stage: string
          id?: string
          image_urls?: string[]
          likes?: number
          log_id: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          growth_stage?: string
          id?: string
          image_urls?: string[]
          likes?: number
          log_id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_updates_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "plant_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_updates_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      update_comments: {
        Row: {
          author_name: string
          body: string
          category: string | null
          confidence: number | null
          created_at: string
          id: string
          is_agronomist_reply: boolean
          is_ai: boolean
          pinned: boolean
          update_id: string
          user_id: string
        }
        Insert: {
          author_name: string
          body: string
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          is_agronomist_reply?: boolean
          is_ai?: boolean
          pinned?: boolean
          update_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          body?: string
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          is_agronomist_reply?: boolean
          is_ai?: boolean
          pinned?: boolean
          update_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_comments_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "timeline_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      update_likes: {
        Row: {
          created_at: string
          update_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          update_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          update_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_likes_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "timeline_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_farm: {
        Args: { _farm: string; _user: string }
        Returns: boolean
      }
      can_review_farm: {
        Args: { _farm: string; _user: string }
        Returns: boolean
      }
      farm_member_role: {
        Args: { _farm: string; _user: string }
        Returns: Database["public"]["Enums"]["farm_member_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_farm_member: {
        Args: { _farm: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "farmer" | "agronomist" | "moderator" | "admin"
      farm_member_role: "owner" | "farmer" | "staff" | "viewer"
      farm_member_status: "invited" | "active" | "suspended" | "removed"
      submission_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "published"
        | "archived"
      submission_type: "progress" | "measurement" | "problem" | "harvest"
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
      app_role: ["farmer", "agronomist", "moderator", "admin"],
      farm_member_role: ["owner", "farmer", "staff", "viewer"],
      farm_member_status: ["invited", "active", "suspended", "removed"],
      submission_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "published",
        "archived",
      ],
      submission_type: ["progress", "measurement", "problem", "harvest"],
    },
  },
} as const
