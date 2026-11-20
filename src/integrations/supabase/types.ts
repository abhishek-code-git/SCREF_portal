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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      franchises: {
        Row: {
          created_at: string
          id: string
          master_franchise_id: string
          name: string
          status: string
          territory_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          master_franchise_id: string
          name: string
          status?: string
          territory_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          master_franchise_id?: string
          name?: string
          status?: string
          territory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchises_master_franchise_id_fkey"
            columns: ["master_franchise_id"]
            isOneToOne: false
            referencedRelation: "master_franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchises_territory_master_fkey"
            columns: ["master_franchise_id", "territory_id"]
            isOneToOne: false
            referencedRelation: "master_franchise_territories"
            referencedColumns: ["master_franchise_id", "id"]
          },
        ]
      }
      master_franchise_territories: {
        Row: {
          created_at: string
          id: string
          master_franchise_id: string
          territory: string
        }
        Insert: {
          created_at?: string
          id?: string
          master_franchise_id: string
          territory: string
        }
        Update: {
          created_at?: string
          id?: string
          master_franchise_id?: string
          territory?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_franchise_territories_master_franchise_id_fkey"
            columns: ["master_franchise_id"]
            isOneToOne: false
            referencedRelation: "master_franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      master_franchises: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      central_admin_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_table: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_table: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_table?: string
          id?: string
        }
        Relationships: []
      }
      network_settings: {
        Row: {
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          full_name: string | null
          phone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          full_name?: string | null
          phone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          full_name?: string | null
          phone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          att_date: string
          class_id: string
          created_at: string
          id: string
          marked_by: string | null
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          att_date?: string
          class_id: string
          created_at?: string
          id?: string
          marked_by?: string | null
          school_id: string
          status: string
          student_id: string
        }
        Update: {
          att_date?: string
          class_id?: string
          created_at?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_teacher: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          section: string
        }
        Insert: {
          class_teacher?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          section?: string
        }
        Update: {
          class_teacher?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          franchise_id: string | null
          id: string
          master_franchise_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          franchise_id?: string | null
          id?: string
          master_franchise_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          franchise_id?: string | null
          id?: string
          master_franchise_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_master_franchise_id_fkey"
            columns: ["master_franchise_id"]
            isOneToOne: false
            referencedRelation: "master_franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      principal_tasks: {
        Row: {
          category: string
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          title: string
          user_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          academic_year: string
          address: string
          city: string
          code: string
          created_at: string
          created_by: string | null
          franchise_id: string | null
          id: string
          name: string
          state: string
          status: string
        }
        Insert: {
          academic_year?: string
          address?: string
          city?: string
          code?: string
          created_at?: string
          created_by?: string | null
          franchise_id?: string | null
          id?: string
          name: string
          state?: string
          status?: string
        }
        Update: {
          academic_year?: string
          address?: string
          city?: string
          code?: string
          created_at?: string
          created_by?: string | null
          franchise_id?: string | null
          id?: string
          name?: string
          state?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          class_id: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
        }
        Insert: {
          accepted_at?: string | null
          class_id?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id: string
        }
        Update: {
          accepted_at?: string | null
          class_id?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          full_name: string
          id: string
          parent_name: string
          parent_phone: string
          roll_no: number
          school_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          full_name: string
          id?: string
          parent_name?: string
          parent_phone?: string
          roll_no?: number
          school_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          full_name?: string
          id?: string
          parent_name?: string
          parent_phone?: string
          roll_no?: number
          school_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          priority: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
          user_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_find_user_by_email: { Args: { _email: string }; Returns: string | null }
      can_access_franchise: { Args: { _franchise_id: string }; Returns: boolean }
      has_super_admin_role: { Args: Record<PropertyKey, never>; Returns: boolean }
      can_access_master_franchise: { Args: { _master_franchise_id: string }; Returns: boolean }
      can_access_school_network: { Args: { _school_id: string }; Returns: boolean }
      can_view_school_members: {
        Args: { _school_id: string }
        Returns: boolean
      }
      central_network_dashboard: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_school_count: number
          class_count: number
          franchise_owner_count: number
          franchise_count: number
          master_franchise_count: number
          pending_school_count: number
          principal_count: number
          school_count: number
          student_count: number
          teacher_count: number
        }[]
      }
      franchise_network_dashboard: {
        Args: { _franchise_id?: string | null; _master_franchise_id?: string | null }
        Returns: {
          academic_year: string
          address: string
          attendance_today_count: number
          attendance_today_present: number
          city: string
          class_count: number
          principal_count: number
          principal_names: string | null
          network_principal_count: number
          network_teacher_count: number
          school_code: string
          school_created_at: string
          school_id: string
          school_name: string
          school_status: string
          state: string
          student_count: number
          teacher_count: number
        }[]
      }
      has_central_role: { Args: never; Returns: boolean }
      has_school_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _school_id: string
        }
        Returns: boolean
      }
      is_school_member: {
        Args: { _school_id: string; _user_id?: string }
        Returns: boolean
      }
      user_school_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      app_role:
        | "central_super_admin"
        | "central_ops_admin"
        | "franchise_owner"
        | "school_principal"
        | "admissions_staff"
        | "teacher"
        | "accountant"
        | "transport_manager"
        | "parent"
        | "student"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "central_super_admin",
        "central_ops_admin",
        "franchise_owner",
        "school_principal",
        "admissions_staff",
        "teacher",
        "accountant",
        "transport_manager",
        "parent",
        "student",
      ],
    },
  },
} as const
