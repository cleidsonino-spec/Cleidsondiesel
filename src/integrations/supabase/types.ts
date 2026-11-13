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
      appointments: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          notes: string | null
          phone: string
          plate: string
          scheduled_date: string
          scheduled_time: string
          service_type: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          vehicle: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          id?: string
          notes?: string | null
          phone: string
          plate: string
          scheduled_date: string
          scheduled_time: string
          service_type: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          vehicle: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          notes?: string | null
          phone?: string
          plate?: string
          scheduled_date?: string
          scheduled_time?: string
          service_type?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          vehicle?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          customer_type: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_type?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_type?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_cpf: string | null
          created_at: string
          expires_at: string
          id: string
          order_id: string
          rejected_at: string | null
          rejected_by: string | null
          snapshot: Json
          state: string
          token: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_cpf?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          order_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          snapshot: Json
          state?: string
          token?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_cpf?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          snapshot?: Json
          state?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_assignments: {
        Row: {
          active: boolean
          assigned_at: string
          assigned_by: string
          id: string
          mechanic_user_id: string
          service_order_id: string
        }
        Insert: {
          active?: boolean
          assigned_at?: string
          assigned_by?: string
          id?: string
          mechanic_user_id: string
          service_order_id: string
        }
        Update: {
          active?: boolean
          assigned_at?: string
          assigned_by?: string
          id?: string
          mechanic_user_id?: string
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_assignments_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          appointment_id: string | null
          complaint: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          customer_id: string | null
          customer_name: string
          diagnosis: string | null
          due_date: string | null
          entry_date: string
          fuel_filter_replacement: boolean | null
          id: string
          inspection_checklist: Json
          labor_value: number
          mileage: string | null
          notes: string | null
          number: number
          part_items: Json | null
          parts: string | null
          parts_value: number
          phone: string | null
          plate: string
          status: Database["public"]["Enums"]["order_status"]
          system_cleaning: boolean | null
          updated_at: string
          vehicle: string
          vehicle_id: string | null
          vehicle_year: string | null
        }
        Insert: {
          appointment_id?: string | null
          complaint: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          customer_id?: string | null
          customer_name: string
          diagnosis?: string | null
          due_date?: string | null
          entry_date?: string
          fuel_filter_replacement?: boolean | null
          id?: string
          inspection_checklist?: Json
          labor_value?: number
          mileage?: string | null
          notes?: string | null
          number?: number
          part_items?: Json | null
          parts?: string | null
          parts_value?: number
          phone?: string | null
          plate: string
          status?: Database["public"]["Enums"]["order_status"]
          system_cleaning?: boolean | null
          updated_at?: string
          vehicle: string
          vehicle_id?: string | null
          vehicle_year?: string | null
        }
        Update: {
          appointment_id?: string | null
          complaint?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          customer_id?: string | null
          customer_name?: string
          diagnosis?: string | null
          due_date?: string | null
          entry_date?: string
          fuel_filter_replacement?: boolean | null
          id?: string
          inspection_checklist?: Json
          labor_value?: number
          mileage?: string | null
          notes?: string | null
          number?: number
          part_items?: Json | null
          parts?: string | null
          parts_value?: number
          phone?: string | null
          plate?: string
          status?: Database["public"]["Enums"]["order_status"]
          system_cleaning?: boolean | null
          updated_at?: string
          vehicle?: string
          vehicle_id?: string | null
          vehicle_year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_dashboard_counters: {
        Row: {
          id: boolean
          reset_at: string
          reset_by: string | null
        }
        Insert: {
          id?: boolean
          reset_at?: string
          reset_by?: string | null
        }
        Update: {
          id?: boolean
          reset_at?: string
          reset_by?: string | null
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_user_id: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          full_name: string
          id: string
          phone: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
          used_at: string | null
        }
        Insert: {
          accepted_user_id?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          phone: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
          used_at?: string | null
        }
        Update: {
          accepted_user_id?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          phone?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      technical_service_logs: {
        Row: {
          created_at: string
          description: string
          id: string
          mechanic_user_id: string
          observations: string | null
          procedure: string
          result: string | null
          service_order_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          mechanic_user_id?: string
          observations?: string | null
          procedure: string
          result?: string | null
          service_order_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          mechanic_user_id?: string
          observations?: string | null
          procedure?: string
          result?: string | null
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_service_logs_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          mileage: string | null
          model: string
          notes: string | null
          plate: string
          updated_at: string
          year: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          mileage?: string | null
          model: string
          notes?: string | null
          plate: string
          updated_at?: string
          year?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          mileage?: string | null
          model?: string
          notes?: string | null
          plate?: string
          updated_at?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_service_procedures: {
        Row: {
          created_at: string
          description: string
          id: string
          observations: string | null
          procedure: string
          result: string | null
          reviewed_by: string
          service_order_id: string
          technical_log_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          observations?: string | null
          procedure: string
          result?: string | null
          reviewed_by?: string
          service_order_id: string
          technical_log_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          observations?: string | null
          procedure?: string
          result?: string | null
          reviewed_by?: string
          service_order_id?: string
          technical_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verified_service_procedures_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_service_procedures_technical_log_id_fkey"
            columns: ["technical_log_id"]
            isOneToOne: true
            referencedRelation: "technical_service_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          coverage: string
          created_at: string
          created_by: string | null
          duration_months: number
          end_date: string
          id: string
          service_order_id: string
          start_date: string
          terms: string
          updated_at: string
        }
        Insert: {
          coverage?: string
          created_at?: string
          created_by?: string | null
          duration_months: number
          end_date: string
          id?: string
          service_order_id: string
          start_date: string
          terms?: string
          updated_at?: string
        }
        Update: {
          coverage?: string
          created_at?: string
          created_by?: string | null
          duration_months?: number
          end_date?: string
          id?: string
          service_order_id?: string
          start_date?: string
          terms?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: true
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_staff_invitation_for_existing_user: {
        Args: { p_token: string }
        Returns: undefined
      }
      approve_quote: { Args: { _name: string; _token: string }; Returns: Json }
      approve_quote_identified: {
        Args: { _cpf: string; _name: string; _token: string }
        Returns: Json
      }
      assign_order_to_mechanic: {
        Args: { _mechanic_user_id: string; _order_id: string; _stage: string }
        Returns: undefined
      }
      booked_slots: { Args: { _date: string }; Returns: string[] }
      get_quote_approval: { Args: { _token: string }; Returns: Json }
      get_staff_appointment_agenda: {
        Args: never
        Returns: {
          appointment_id: string
          appointment_status: string
          customer_name: string
          mechanic_name: string
          notes: string
          order_number: number
          order_status: string
          phone: string
          plate: string
          scheduled_date: string
          scheduled_time: string
          service_type: string
          vehicle: string
        }[]
      }
      get_staff_invitation_email: { Args: { p_token: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_mechanic_assigned: {
        Args: { _order_id: string; _user_id?: string }
        Returns: boolean
      }
      issue_quote_approval: { Args: { _order_id: string }; Returns: Json }
      lookup_plate: {
        Args: { _plate: string }
        Returns: {
          complaint: string
          due_date: string
          entry_date: string
          number: number
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          vehicle: string
        }[]
      }
      lookup_vehicle: {
        Args: { _plate: string }
        Returns: {
          vehicle: string
          vehicle_year: string
        }[]
      }
      mechanic_add_technical_log: {
        Args: {
          _description: string
          _observations?: string
          _procedure: string
          _result?: string
          _service_order_id: string
        }
        Returns: string
      }
      mechanic_complete_diagnosis:
        | {
            Args: { _diagnosis: string; _order_id: string }
            Returns: undefined
          }
        | {
            Args: {
              _diagnosis: string
              _fuel_filter_replacement: boolean
              _order_id: string
              _system_cleaning: boolean
            }
            Returns: undefined
          }
      mechanic_start_diagnosis: {
        Args: { _order_id: string }
        Returns: undefined
      }
      mechanic_update_order_status: {
        Args: {
          _order_id: string
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      normalize_plate: { Args: { _p: string }; Returns: string }
      quote_snapshot: {
        Args: { o: Database["public"]["Tables"]["service_orders"]["Row"] }
        Returns: Json
      }
      reject_quote_identified: {
        Args: { _cpf: string; _name: string; _token: string }
        Returns: Json
      }
      secretaria_complete_appointment: {
        Args: { _appointment_id: string }
        Returns: undefined
      }
      secretaria_confirm_appointment: {
        Args: { _appointment_id: string }
        Returns: undefined
      }
      staff_assign_service_order: {
        Args: { _mechanic_user_id: string; _service_order_id: string }
        Returns: string
      }
      staff_mechanic_service_counts: {
        Args: never
        Returns: {
          active_orders: number
          assigned_orders: number
          completed_orders: number
          mechanic_name: string
          mechanic_user_id: string
          technical_entries: number
          verified_procedures: number
        }[]
      }
      staff_reset_mechanic_service_counts: { Args: never; Returns: string }
      staff_verify_technical_log: {
        Args: { _technical_log_id: string }
        Returns: string
      }
      valid_cpf: { Args: { _cpf: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "secretaria" | "mecanico"
      appointment_status: "pendente" | "confirmado" | "concluido" | "cancelado"
      order_status:
        | "recebido"
        | "em_analise"
        | "aguardando_aprovacao"
        | "em_servico"
        | "pronto"
        | "entregue"
        | "cancelado"
        | "aprovado_aguardando_encaminhamento"
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
      app_role: ["admin", "user", "secretaria", "mecanico"],
      appointment_status: ["pendente", "confirmado", "concluido", "cancelado"],
      order_status: [
        "recebido",
        "em_analise",
        "aguardando_aprovacao",
        "em_servico",
        "pronto",
        "entregue",
        "cancelado",
        "aprovado_aguardando_encaminhamento",
      ],
    },
  },
} as const
