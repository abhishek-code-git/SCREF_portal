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
          address: string
          city: string
          code: string | null
          created_at: string
          email: string
          id: string
          master_franchise_id: string
          name: string
          owner_name: string
          phone: string
          state: string
          status: string
          territory_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          code?: string | null
          created_at?: string
          email?: string
          id?: string
          master_franchise_id: string
          name: string
          owner_name?: string
          phone?: string
          state?: string
          status?: string
          territory_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          code?: string | null
          created_at?: string
          email?: string
          id?: string
          master_franchise_id?: string
          name?: string
          owner_name?: string
          phone?: string
          state?: string
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
      class_teacher_assignments: {
        Row: {
          assigned_by: string | null
          class_id: string
          created_at: string
          id: string
          is_active: boolean
          school_id: string
          subject_name: string
          teacher_user_id: string
        }
        Insert: {
          assigned_by?: string | null
          class_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          school_id: string
          subject_name?: string
          teacher_user_id: string
        }
        Update: {
          assigned_by?: string | null
          class_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          school_id?: string
          subject_name?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teacher_assignments_class_id_school_id_fkey"
            columns: ["class_id", "school_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "class_teacher_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          decline_reason: string
          email: string
          franchise_id: string | null
          id: string
          logo_url: string
          name: string
          phone: string
          principal_name: string
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
          decline_reason?: string
          email?: string
          franchise_id?: string | null
          id?: string
          logo_url?: string
          name: string
          phone?: string
          principal_name?: string
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
          decline_reason?: string
          email?: string
          franchise_id?: string | null
          id?: string
          logo_url?: string
          name?: string
          phone?: string
          principal_name?: string
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
          address: string
          admission_no: string | null
          admitted_on: string
          class_id: string
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          guardian_email: string
          guardian_name: string
          guardian_phone: string
          id: string
          leaving_reason: string
          left_on: string | null
          parent_name: string
          parent_phone: string
          roll_no: number
          school_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          address?: string
          admission_no?: string | null
          admitted_on?: string
          class_id: string
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          guardian_email?: string
          guardian_name?: string
          guardian_phone?: string
          id?: string
          leaving_reason?: string
          left_on?: string | null
          parent_name?: string
          parent_phone?: string
          roll_no?: number
          school_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          admission_no?: string | null
          admitted_on?: string
          class_id?: string
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          guardian_email?: string
          guardian_name?: string
          guardian_phone?: string
          id?: string
          leaving_reason?: string
          left_on?: string | null
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
      subjects: {
        Row: {
          id: string
          school_id: string
          name: string
          code: string
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          name: string
          code?: string
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          name?: string
          code?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          id: string
          school_id: string
          class_id: string
          subject_id: string | null
          teacher_user_id: string
          day_of_week: number
          period: number
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          class_id: string
          subject_id?: string | null
          teacher_user_id: string
          day_of_week: number
          period: number
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          class_id?: string
          subject_id?: string | null
          teacher_user_id?: string
          day_of_week?: number
          period?: number
          start_time?: string
          end_time?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          id: string
          school_id: string
          class_id: string
          subject_id: string | null
          title: string
          description: string
          due_date: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id: string
          class_id: string
          subject_id?: string | null
          title: string
          description?: string
          due_date?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          class_id?: string
          subject_id?: string | null
          title?: string
          description?: string
          due_date?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          id: string
          school_id: string
          name: string
          exam_date: string | null
          status: Database["public"]["Enums"]["exam_status"]
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          name: string
          exam_date?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          name?: string
          exam_date?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_marks: {
        Row: {
          id: string
          school_id: string
          exam_id: string
          class_id: string
          subject_id: string
          student_id: string
          marks_obtained: number
          max_marks: number
          entered_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id: string
          exam_id: string
          class_id: string
          subject_id: string
          student_id: string
          marks_obtained: number
          max_marks: number
          entered_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          exam_id?: string
          class_id?: string
          subject_id?: string
          student_id?: string
          marks_obtained?: number
          max_marks?: number
          entered_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_marks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          id: string
          school_id: string
          class_id: string | null
          title: string
          body: string
          audience: string
          created_by: string
          published: boolean
          pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id: string
          class_id?: string | null
          title: string
          body?: string
          audience?: string
          created_by: string
          published?: boolean
          pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          class_id?: string | null
          title?: string
          body?: string
          audience?: string
          created_by?: string
          published?: boolean
          pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_enquiries: {
        Row: {
          id: string
          school_id: string
          child_name: string
          parent_name: string
          parent_phone: string
          parent_email: string
          target_class: string
          source: string
          stage: string
          follow_up_date: string | null
          assigned_to: string | null
          notes: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          school_id: string
          child_name: string
          parent_name?: string
          parent_phone?: string
          parent_email?: string
          target_class?: string
          source?: string
          stage?: string
          follow_up_date?: string | null
          assigned_to?: string | null
          notes?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          child_name?: string
          parent_name?: string
          parent_phone?: string
          parent_email?: string
          target_class?: string
          source?: string
          stage?: string
          follow_up_date?: string | null
          assigned_to?: string | null
          notes?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_enquiries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_certificates: {
        Row: {
          id: string
          school_id: string
          student_id: string
          tc_no: string
          issued_on: string
          reason: string
          conduct: string
          class_at_leaving: string
          remarks: string
          issued_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          school_id: string
          student_id: string
          tc_no: string
          issued_on?: string
          reason: string
          conduct?: string
          class_at_leaving?: string
          remarks?: string
          issued_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          school_id?: string
          student_id?: string
          tc_no?: string
          issued_on?: string
          reason?: string
          conduct?: string
          class_at_leaving?: string
          remarks?: string
          issued_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
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
      is_franchise_owner: { Args: { _franchise_id: string }; Returns: boolean }
      is_franchise_owner_of_school: { Args: { _school_id: string }; Returns: boolean }
      franchise_is_open: { Args: { _franchise_id: string }; Returns: boolean }
      is_master_owner: { Args: { _master_franchise_id: string }; Returns: boolean }
      is_master_owner_of_franchise: { Args: { _franchise_id: string }; Returns: boolean }
      is_master_owner_of_school: { Args: { _school_id: string }; Returns: boolean }
      master_franchise_overview: {
        Args: { _master_franchise_id: string }
        Returns: {
          territory_count: number
          franchise_count: number
          active_franchise_count: number
          pending_franchise_count: number
          school_count: number
          active_school_count: number
          pending_school_count: number
          student_count: number
          teacher_count: number
          principal_count: number
          attendance_today_count: number
          attendance_today_present: number
          franchises_without_owner: number
          schools_without_principal: number
        }[]
      }
      master_franchise_franchise_stats: {
        Args: { _master_franchise_id: string }
        Returns: {
          franchise_id: string
          franchise_name: string
          franchise_status: string
          territory: string | null
          created_at: string
          school_count: number
          active_school_count: number
          student_count: number
          teacher_count: number
          owner_names: string | null
          attendance_today_count: number
          attendance_today_present: number
        }[]
      }
      franchise_overview: {
        Args: { _franchise_id: string }
        Returns: {
          school_count: number
          active_school_count: number
          pending_school_count: number
          student_count: number
          teacher_count: number
          principal_count: number
          attendance_today_count: number
          attendance_today_present: number
          schools_without_principal: number
        }[]
      }
      franchise_dashboard_scope: {
        Args: { _franchise_id: string }
        Returns: {
          id: string
          name: string
          status: string
          master_status: string
        }[]
      }
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
      is_school_leadership: { Args: { _school_id: string }; Returns: boolean }
      school_is_writable: { Args: { _school_id: string }; Returns: boolean }
      update_school_profile: {
        Args: {
          _school_id: string
          _phone?: string | null
          _email?: string | null
          _address?: string | null
          _city?: string | null
          _state?: string | null
          _principal_name?: string | null
          _logo_url?: string | null
        }
        Returns: Database["public"]["Tables"]["schools"]["Row"]
      }
      issue_transfer_certificate: {
        Args: {
          _student_id: string
          _reason: string
          _conduct?: string
          _remarks?: string
        }
        Returns: Database["public"]["Tables"]["transfer_certificates"]["Row"]
      }
      promote_students: {
        Args: {
          _from_class: string
          _to_class: string
          _student_ids: string[]
        }
        Returns: number
      }
      principal_overview: {
        Args: { _school_id: string }
        Returns: {
          class_count: number
          student_count: number
          teacher_count: number
          attendance_today_marked: number
          attendance_today_present: number
          classes_without_attendance_today: number
          classes_without_class_teacher: number
          classes_without_timetable: number
          exams_open_for_marks: number
          exams_ready_to_publish: number
          enquiries_total: number
          enquiries_followup_due: number
          notices_last_7_days: number
        }[]
      }
      attendance_report: {
        Args: { _school_id: string; _from: string; _to: string }
        Returns: {
          class_id: string
          class_name: string
          section: string
          att_date: string
          present_count: number
          absent_count: number
          late_count: number
          leave_count: number
          marked_count: number
        }[]
      }
      student_attendance_percentage: {
        Args: { _school_id: string; _from: string; _to: string }
        Returns: {
          student_id: string
          admission_no: string | null
          full_name: string
          roll_no: number
          class_id: string
          class_name: string
          section: string
          present_days: number
          total_marked_days: number
          attendance_pct: number | null
        }[]
      }
      enrolment_report: {
        Args: { _school_id: string }
        Returns: {
          class_id: string
          class_name: string
          section: string
          total_count: number
          boys_count: number
          girls_count: number
          other_count: number
        }[]
      }
      exam_result_summary: {
        Args: { _exam_id: string; _class_id: string }
        Returns: {
          student_id: string
          admission_no: string | null
          roll_no: number
          full_name: string
          total_obtained: number
          total_max: number
          percentage: number
          exam_rank: number | null
          subjects_entered: number
        }[]
      }
      school_staff_directory: {
        Args: { _school_id: string }
        Returns: {
          membership_id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          full_name: string
          phone: string
          email: string
          last_sign_in_at: string | null
        }[]
      }
      can_read_franchise_dashboard: { Args: { _franchise_id: string }; Returns: boolean }
      update_school_request: {
        Args: {
          _school_id: string
          _name: string
          _city: string
          _state: string
          _address: string
          _academic_year: string
        }
        Returns: Database["public"]["Tables"]["schools"]["Row"]
      }
      resubmit_school_request: {
        Args: {
          _school_id: string
          _name: string
          _city: string
          _state: string
          _address: string
          _academic_year: string
        }
        Returns: Database["public"]["Tables"]["schools"]["Row"]
      }
      cancel_school_request: { Args: { _school_id: string }; Returns: boolean }
      update_franchise_contact: {
        Args: {
          _franchise_id: string
          _phone?: string | null
          _email?: string | null
          _address?: string | null
          _city?: string | null
          _state?: string | null
          _owner_name?: string | null
        }
        Returns: Database["public"]["Tables"]["franchises"]["Row"]
      }
      my_franchises: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          code: string | null
          status: string
          master_name: string
          master_status: string
          territory: string | null
          phone: string
          email: string
          address: string
          city: string
          state: string
          owner_name: string
        }[]
      }
      franchise_schools_list: {
        Args: { _franchise_id: string }
        Returns: {
          school_id: string
          code: string
          name: string
          city: string
          state: string
          address: string
          academic_year: string
          status: string
          decline_reason: string
          created_at: string
          phone: string
          email: string
          principal_name: string
        }[]
      }
      franchise_school_comparison: {
        Args: { _franchise_id: string }
        Returns: {
          school_id: string
          name: string
          code: string
          status: string
          student_count: number
          teacher_count: number
          has_principal: boolean
          attendance_pct_30d: number | null
          classes_without_attendance_today: number
          open_enquiries: number
          admitted_30d: number
          last_activity_at: string | null
        }[]
      }
      franchise_attendance_report: {
        Args: { _franchise_id: string; _from: string; _to: string }
        Returns: {
          school_id: string
          school_name: string
          att_date: string
          marked: number
          present: number
          absent: number
          late: number
          leave: number
        }[]
      }
      franchise_admissions_funnel: {
        Args: { _franchise_id: string; _from: string; _to: string }
        Returns: {
          school_id: string
          school_name: string
          new_count: number
          contacted_count: number
          visited_count: number
          applied_count: number
          admitted_count: number
          lost_count: number
          total_count: number
          conversion_pct: number
        }[]
      }
      franchise_enrolment_report: {
        Args: { _franchise_id: string }
        Returns: {
          school_id: string
          school_name: string
          class_id: string
          class_name: string
          section: string
          total_count: number
          boys_count: number
          girls_count: number
          other_count: number
        }[]
      }
      franchise_activity_feed: {
        Args: { _franchise_id: string; _limit?: number }
        Returns: {
          id: string
          actor_name: string
          what: string
          occurred_at: string
          school_name: string
        }[]
      }
      franchise_needs_attention: {
        Args: { _franchise_id: string }
        Returns: {
          kind: string
          school_id: string
          school_name: string
          detail: string
          since: string
        }[]
      }
      franchise_team_directory: {
        Args: { _franchise_id: string }
        Returns: {
          kind: string
          record_id: string
          user_id: string | null
          school_id: string
          school_name: string
          role: Database["public"]["Enums"]["app_role"]
          full_name: string
          phone: string
          email: string
          status: string
          created_at: string
        }[]
      }
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
      exam_status: "draft" | "marks_open" | "published"
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
