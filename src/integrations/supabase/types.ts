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
      material_list_items: {
        Row: {
          catalog_position: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          list_id: string
          manufacturer: string | null
          notes: string | null
          pump_code: string | null
          quantity_needed: number
          reference_code: string
          technical_component_id: string | null
          technical_reference_id: string | null
        }
        Insert: {
          catalog_position?: string | null
          created_at?: string
          created_by?: string
          description: string
          id?: string
          list_id: string
          manufacturer?: string | null
          notes?: string | null
          pump_code?: string | null
          quantity_needed?: number
          reference_code: string
          technical_component_id?: string | null
          technical_reference_id?: string | null
        }
        Update: {
          catalog_position?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          list_id?: string
          manufacturer?: string | null
          notes?: string | null
          pump_code?: string | null
          quantity_needed?: number
          reference_code?: string
          technical_component_id?: string | null
          technical_reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "material_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_list_items_technical_component_id_fkey"
            columns: ["technical_component_id"]
            isOneToOne: false
            referencedRelation: "technical_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_list_items_technical_reference_id_fkey"
            columns: ["technical_reference_id"]
            isOneToOne: false
            referencedRelation: "technical_references"
            referencedColumns: ["id"]
          },
        ]
      }
      material_lists: {
        Row: {
          created_at: string
          created_by: string
          finalized_at: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          finalized_at?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          finalized_at?: string | null
          id?: string
          status?: string
          title?: string
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
      service_order_completions: {
        Row: {
          completed_at: string
          description: string
          id: string
          mechanic_user_id: string
          service_order_id: string
        }
        Insert: {
          completed_at?: string
          description: string
          id?: string
          mechanic_user_id: string
          service_order_id: string
        }
        Update: {
          completed_at?: string
          description?: string
          id?: string
          mechanic_user_id?: string
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_completions_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: true
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_inspection_reports: {
        Row: {
          created_at: string
          created_by: string | null
          diagnosis: string
          executed_parts: string
          id: string
          inspection_observations: string
          rejected_items: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_order_id: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          diagnosis?: string
          executed_parts?: string
          id?: string
          inspection_observations?: string
          rejected_items?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_order_id: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          diagnosis?: string
          executed_parts?: string
          id?: string
          inspection_observations?: string
          rejected_items?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_order_id?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_inspection_reports_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_payments: {
        Row: {
          amount: number
          confirmed_at: string
          confirmed_by: string
          id: string
          note: string | null
          service_order_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string
          confirmed_by: string
          id?: string
          note?: string | null
          service_order_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string
          confirmed_by?: string
          id?: string
          note?: string | null
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_payments_service_order_id_fkey"
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
          customer_id: string | null
          customer_name: string
          delivered_at: string | null
          diagnosis: string | null
          discount_percent: number
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
          plate: string | null
          status: Database["public"]["Enums"]["order_status"]
          system_cleaning: boolean | null
          updated_at: string
          vehicle: string
          vehicle_id: string | null
          vehicle_intake_id: string | null
          vehicle_year: string | null
        }
        Insert: {
          appointment_id?: string | null
          complaint: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          delivered_at?: string | null
          diagnosis?: string | null
          discount_percent?: number
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
          plate?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          system_cleaning?: boolean | null
          updated_at?: string
          vehicle: string
          vehicle_id?: string | null
          vehicle_intake_id?: string | null
          vehicle_year?: string | null
        }
        Update: {
          appointment_id?: string | null
          complaint?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          delivered_at?: string | null
          diagnosis?: string | null
          discount_percent?: number
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
          plate?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          system_cleaning?: boolean | null
          updated_at?: string
          vehicle?: string
          vehicle_id?: string | null
          vehicle_intake_id?: string | null
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
          {
            foreignKeyName: "service_orders_vehicle_intake_id_fkey"
            columns: ["vehicle_intake_id"]
            isOneToOne: false
            referencedRelation: "vehicle_intake_records"
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
      technical_applications: {
        Row: {
          application_notes: string | null
          component_id: string | null
          created_at: string
          created_by: string | null
          engine_id: string | null
          equipment_manufacturer: string | null
          equipment_model: string | null
          equipment_type: string | null
          id: string
          information_status: string
          source_description: string | null
          source_url: string | null
          updated_at: string
          year_end: number | null
          year_start: number | null
        }
        Insert: {
          application_notes?: string | null
          component_id?: string | null
          created_at?: string
          created_by?: string | null
          engine_id?: string | null
          equipment_manufacturer?: string | null
          equipment_model?: string | null
          equipment_type?: string | null
          id?: string
          information_status?: string
          source_description?: string | null
          source_url?: string | null
          updated_at?: string
          year_end?: number | null
          year_start?: number | null
        }
        Update: {
          application_notes?: string | null
          component_id?: string | null
          created_at?: string
          created_by?: string | null
          engine_id?: string | null
          equipment_manufacturer?: string | null
          equipment_model?: string | null
          equipment_type?: string | null
          id?: string
          information_status?: string
          source_description?: string | null
          source_url?: string | null
          updated_at?: string
          year_end?: number | null
          year_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_applications_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "technical_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_applications_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "technical_engines"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "technical_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_components: {
        Row: {
          category_id: string | null
          component_code: string | null
          component_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          information_status: string
          manufacturer_id: string | null
          model: string | null
          name: string
          technical_notes: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          component_code?: string | null
          component_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          information_status?: string
          manufacturer_id?: string | null
          model?: string | null
          name: string
          technical_notes?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          component_code?: string | null
          component_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          information_status?: string
          manufacturer_id?: string | null
          model?: string | null
          name?: string
          technical_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_components_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "technical_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_components_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "technical_manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_documents: {
        Row: {
          access_type: string
          component_id: string | null
          copyright_notes: string | null
          created_at: string
          created_by: string | null
          document_type: string
          engine_id: string | null
          id: string
          information_status: string
          is_active: boolean
          last_checked_at: string | null
          manufacturer_id: string | null
          notes: string | null
          publication_date: string | null
          source_name: string
          source_url: string
          title: string
          updated_at: string
        }
        Insert: {
          access_type?: string
          component_id?: string | null
          copyright_notes?: string | null
          created_at?: string
          created_by?: string | null
          document_type: string
          engine_id?: string | null
          id?: string
          information_status?: string
          is_active?: boolean
          last_checked_at?: string | null
          manufacturer_id?: string | null
          notes?: string | null
          publication_date?: string | null
          source_name: string
          source_url: string
          title: string
          updated_at?: string
        }
        Update: {
          access_type?: string
          component_id?: string | null
          copyright_notes?: string | null
          created_at?: string
          created_by?: string | null
          document_type?: string
          engine_id?: string | null
          id?: string
          information_status?: string
          is_active?: boolean
          last_checked_at?: string | null
          manufacturer_id?: string | null
          notes?: string | null
          publication_date?: string | null
          source_name?: string
          source_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_documents_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "technical_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_documents_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "technical_engines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_documents_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "technical_manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_engines: {
        Row: {
          created_at: string
          created_by: string | null
          cylinder_configuration: string | null
          displacement: string | null
          engine_code: string | null
          family: string | null
          fuel_system: string | null
          id: string
          information_status: string
          manufacturer_id: string
          model: string
          serial_number_range: string | null
          technical_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cylinder_configuration?: string | null
          displacement?: string | null
          engine_code?: string | null
          family?: string | null
          fuel_system?: string | null
          id?: string
          information_status?: string
          manufacturer_id: string
          model: string
          serial_number_range?: string | null
          technical_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cylinder_configuration?: string | null
          displacement?: string | null
          engine_code?: string | null
          family?: string | null
          fuel_system?: string | null
          id?: string
          information_status?: string
          manufacturer_id?: string
          model?: string
          serial_number_range?: string | null
          technical_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_engines_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "technical_manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_fault_code_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string
          fault_code_id: string
          id: string
          reference_notes: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id: string
          fault_code_id: string
          id?: string
          reference_notes?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string
          fault_code_id?: string
          id?: string
          reference_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_fault_code_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "technical_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_fault_code_documents_fault_code_id_fkey"
            columns: ["fault_code_id"]
            isOneToOne: false
            referencedRelation: "technical_fault_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_fault_codes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          diagnostic_procedure: string | null
          document_id: string | null
          engine_id: string
          fault_code: string
          fault_name: string | null
          id: string
          information_status: string
          notes: string | null
          possible_causes: string | null
          repair_procedure: string | null
          source_section: string | null
          symptoms: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnostic_procedure?: string | null
          document_id?: string | null
          engine_id: string
          fault_code: string
          fault_name?: string | null
          id?: string
          information_status?: string
          notes?: string | null
          possible_causes?: string | null
          repair_procedure?: string | null
          source_section?: string | null
          symptoms?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnostic_procedure?: string | null
          document_id?: string | null
          engine_id?: string
          fault_code?: string
          fault_name?: string | null
          id?: string
          information_status?: string
          notes?: string | null
          possible_causes?: string | null
          repair_procedure?: string | null
          source_section?: string | null
          symptoms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_fault_codes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "technical_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_fault_codes_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "technical_engines"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_figure_hotspots: {
        Row: {
          catalog_position: string
          component_id: string
          created_at: string
          document_id: string
          height: number
          id: string
          information_status: string
          is_active: boolean
          notes: string | null
          pdf_page_number: number
          printed_page_number: number | null
          reference_id: string | null
          shape: string
          updated_at: string
          width: number
          x: number
          y: number
        }
        Insert: {
          catalog_position: string
          component_id: string
          created_at?: string
          document_id: string
          height: number
          id?: string
          information_status?: string
          is_active?: boolean
          notes?: string | null
          pdf_page_number: number
          printed_page_number?: number | null
          reference_id?: string | null
          shape?: string
          updated_at?: string
          width: number
          x: number
          y: number
        }
        Update: {
          catalog_position?: string
          component_id?: string
          created_at?: string
          document_id?: string
          height?: number
          id?: string
          information_status?: string
          is_active?: boolean
          notes?: string | null
          pdf_page_number?: number
          printed_page_number?: number | null
          reference_id?: string | null
          shape?: string
          updated_at?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "technical_figure_hotspots_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "technical_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_figure_hotspots_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "technical_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_figure_hotspots_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "technical_references"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_manufacturers: {
        Row: {
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          manufacturer_type: string
          name: string
          notes: string | null
          official_website: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manufacturer_type?: string
          name: string
          notes?: string | null
          official_website?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manufacturer_type?: string
          name?: string
          notes?: string | null
          official_website?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      technical_references: {
        Row: {
          catalog_position: string | null
          catalog_quantity: number | null
          component_id: string
          created_at: string
          created_by: string | null
          id: string
          information_status: string
          notes: string | null
          reference_code: string
          reference_manufacturer_id: string | null
          relation_type: string
          source_description: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          catalog_position?: string | null
          catalog_quantity?: number | null
          component_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          information_status?: string
          notes?: string | null
          reference_code: string
          reference_manufacturer_id?: string | null
          relation_type?: string
          source_description?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          catalog_position?: string | null
          catalog_quantity?: number | null
          component_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          information_status?: string
          notes?: string | null
          reference_code?: string
          reference_manufacturer_id?: string | null
          relation_type?: string
          source_description?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_references_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "technical_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_references_reference_manufacturer_id_fkey"
            columns: ["reference_manufacturer_id"]
            isOneToOne: false
            referencedRelation: "technical_manufacturers"
            referencedColumns: ["id"]
          },
        ]
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
          deactivated_at: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_intake_records: {
        Row: {
          arrived_on_tow_truck: boolean | null
          created_at: string
          customer_name: string
          delivered_items: Json
          id: string
          intake_type: string
          notes: string | null
          plate: string | null
          received_at: string
          received_by: string
          received_by_name: string
          vehicle: string
        }
        Insert: {
          arrived_on_tow_truck?: boolean | null
          created_at?: string
          customer_name: string
          delivered_items?: Json
          id?: string
          intake_type?: string
          notes?: string | null
          plate?: string | null
          received_at?: string
          received_by: string
          received_by_name: string
          vehicle: string
        }
        Update: {
          arrived_on_tow_truck?: boolean | null
          created_at?: string
          customer_name?: string
          delivered_items?: Json
          id?: string
          intake_type?: string
          notes?: string | null
          plate?: string | null
          received_at?: string
          received_by?: string
          received_by_name?: string
          vehicle?: string
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
      warranty_change_events: {
        Row: {
          actor_id: string | null
          after_data: Json
          before_data: Json | null
          event_type: string
          id: string
          occurred_at: string
          warranty_id: string
        }
        Insert: {
          actor_id?: string | null
          after_data: Json
          before_data?: Json | null
          event_type: string
          id?: string
          occurred_at?: string
          warranty_id: string
        }
        Update: {
          actor_id?: string | null
          after_data?: Json
          before_data?: Json | null
          event_type?: string
          id?: string
          occurred_at?: string
          warranty_id?: string
        }
        Relationships: []
      }
      warranty_return_events: {
        Row: {
          actor_id: string | null
          after_data: Json
          before_data: Json | null
          event_type: string
          id: string
          occurred_at: string
          warranty_return_id: string
        }
        Insert: {
          actor_id?: string | null
          after_data: Json
          before_data?: Json | null
          event_type: string
          id?: string
          occurred_at?: string
          warranty_return_id: string
        }
        Update: {
          actor_id?: string | null
          after_data?: Json
          before_data?: Json | null
          event_type?: string
          id?: string
          occurred_at?: string
          warranty_return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_return_events_warranty_return_id_fkey"
            columns: ["warranty_return_id"]
            isOneToOne: false
            referencedRelation: "warranty_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_returns: {
        Row: {
          closed_at: string | null
          complaint: string
          created_by: string
          customer_update: string
          diagnosis: string
          id: string
          labor_description: string
          parts_used: string
          received_at: string
          resolution: string
          return_service_order_id: string | null
          service_order_id: string
          status: string
          updated_at: string
          updated_by: string
          warranty_id: string
        }
        Insert: {
          closed_at?: string | null
          complaint: string
          created_by: string
          customer_update?: string
          diagnosis?: string
          id?: string
          labor_description?: string
          parts_used?: string
          received_at?: string
          resolution?: string
          return_service_order_id?: string | null
          service_order_id: string
          status?: string
          updated_at?: string
          updated_by: string
          warranty_id: string
        }
        Update: {
          closed_at?: string | null
          complaint?: string
          created_by?: string
          customer_update?: string
          diagnosis?: string
          id?: string
          labor_description?: string
          parts_used?: string
          received_at?: string
          resolution?: string
          return_service_order_id?: string | null
          service_order_id?: string
          status?: string
          updated_at?: string
          updated_by?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_returns_return_service_order_id_fkey"
            columns: ["return_service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_returns_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_returns_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
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
      add_material_list_item: {
        Args: {
          _catalog_position: string
          _description: string
          _manufacturer: string
          _pump_code: string
          _quantity: number
          _reference_code: string
          _technical_component_id: string
          _technical_reference_id: string
        }
        Returns: string
      }
      admin_get_financial_overview: {
        Args: never
        Returns: {
          balance: number
          customer_name: string
          last_payment_at: string
          order_number: number
          order_status: string
          paid_percent: number
          plate: string
          received: number
          service_order_id: string
          total: number
        }[]
      }
      admin_list_staff_accounts: {
        Args: never
        Returns: {
          created_at: string
          deactivated_at: string
          email: string
          full_name: string
          is_active: boolean
          role: string
          user_id: string
        }[]
      }
      admin_set_staff_active: {
        Args: { _active: boolean; _staff_user_id: string }
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
      confirm_service_order_payment: {
        Args: { _amount: number; _note?: string; _order_id: string }
        Returns: Json
      }
      finalize_material_list: { Args: { _list_id: string }; Returns: undefined }
      get_approved_inspection_report_for_pdf: {
        Args: { _service_order_id: string }
        Returns: Json
      }
      get_collection_queue: {
        Args: never
        Returns: {
          balance: number
          customer_name: string
          last_payment_at: string
          order_number: number
          order_status: string
          paid_percent: number
          plate: string
          received: number
          service_order_id: string
          total: number
        }[]
      }
      get_mechanic_appointment_agenda: {
        Args: never
        Returns: {
          appointment_id: string
          customer_name: string
          mechanic_name: string
          scheduled_date: string
          scheduled_time: string
        }[]
      }
      get_quote_approval: { Args: { _token: string }; Returns: Json }
      get_service_order_payment_history: {
        Args: { _order_id: string }
        Returns: {
          amount: number
          confirmed_at: string
          confirmed_by: string
          confirmed_by_name: string
          note: string
          payment_id: string
        }[]
      }
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
      get_warranty_return_context: {
        Args: { _return_order_id: string }
        Returns: {
          original_complaint: string
          original_diagnosis: string
          original_order_id: string
          original_order_number: number
          original_parts: string
          original_technical_history: Json
          return_complaint: string
          return_diagnosis: string
          return_id: string
          return_labor_description: string
          return_parts_used: string
          return_resolution: string
        }[]
      }
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
      material_list_staff_access: { Args: never; Returns: boolean }
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
      mechanic_complete_service: {
        Args: { _description: string; _order_id: string }
        Returns: string
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
      open_warranty_return_service_order:
        | { Args: { _return_id: string }; Returns: string }
        | { Args: { _intake_id: string; _return_id: string }; Returns: string }
        | {
            Args: { _legacy_intake: Json; _return_id: string }
            Returns: string
          }
      quote_snapshot: {
        Args: { o: Database["public"]["Tables"]["service_orders"]["Row"] }
        Returns: Json
      }
      register_warranty_return: {
        Args: {
          _complaint: string
          _customer_update?: string
          _diagnosis?: string
          _labor_description?: string
          _parts_used?: string
          _resolution?: string
          _return_id?: string
          _status?: string
          _warranty_id: string
        }
        Returns: string
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
      staff_mechanic_labor_summary: {
        Args: { _from_date?: string; _to_date?: string }
        Returns: {
          completed_orders: number
          labor_average: number
          labor_total: number
          mechanic_name: string
          mechanic_user_id: string
        }[]
      }
      staff_mechanic_performance: {
        Args: { _end_date: string; _start_date: string }
        Returns: {
          completed_orders: number
          labor_average: number
          labor_total: number
          mechanic_name: string
          mechanic_user_id: string
        }[]
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
