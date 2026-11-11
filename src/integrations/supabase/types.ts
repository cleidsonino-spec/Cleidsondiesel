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
      service_orders: {
        Row: {
          appointment_id: string | null
          complaint: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          diagnosis: string | null
          due_date: string | null
          entry_date: string
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
          customer_id?: string | null
          customer_name: string
          diagnosis?: string | null
          due_date?: string | null
          entry_date?: string
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
          customer_id?: string | null
          customer_name?: string
          diagnosis?: string | null
          due_date?: string | null
          entry_date?: string
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
      approve_quote: { Args: { _name: string; _token: string }; Returns: Json }
      approve_quote_identified: {
        Args: { _cpf: string; _name: string; _token: string }
        Returns: Json
      }
      booked_slots: { Args: { _date: string }; Returns: string[] }
      get_quote_approval: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
      normalize_plate: { Args: { _p: string }; Returns: string }
      quote_snapshot: {
        Args: { o: Database["public"]["Tables"]["service_orders"]["Row"] }
        Returns: Json
      }
      valid_cpf: { Args: { _cpf: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      appointment_status: "pendente" | "confirmado" | "concluido" | "cancelado"
      order_status:
        | "recebido"
        | "em_analise"
        | "aguardando_aprovacao"
        | "em_servico"
        | "pronto"
        | "entregue"
        | "cancelado"
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
      app_role: ["admin", "user"],
      appointment_status: ["pendente", "confirmado", "concluido", "cancelado"],
      order_status: [
        "recebido",
        "em_analise",
        "aguardando_aprovacao",
        "em_servico",
        "pronto",
        "entregue",
        "cancelado",
      ],
    },
  },
} as const
