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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          label: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          label: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          label?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      carousel_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: number
          image_url: string
          is_active: boolean
          service_slug: string
          sort_order: number
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: never
          image_url: string
          is_active?: boolean
          service_slug: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: never
          image_url?: string
          is_active?: boolean
          service_slug?: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          min_order_boxes: number | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          min_order_boxes?: number | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          min_order_boxes?: number | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          address: string | null
          business_name: string
          contact_email: string | null
          contact_phone: string | null
          id: boolean
          order_notification_email: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          id?: boolean
          order_notification_email?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          id?: boolean
          order_notification_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          message: string
          topic: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          message: string
          topic?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string
          topic?: string | null
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          category_id: number
          created_at: string
          description: string | null
          dessert_count: number
          id: number
          is_active: boolean
          main_count: number
          name: string
          price_cents: number
          pricing_mode: string
          rice_bowl_count: number
          rice_count: number
          side_count: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: number
          created_at?: string
          description?: string | null
          dessert_count?: number
          id?: number
          is_active?: boolean
          main_count?: number
          name: string
          price_cents: number
          pricing_mode?: string
          rice_bowl_count?: number
          rice_count?: number
          side_count?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: number
          created_at?: string
          description?: string | null
          dessert_count?: number
          id?: number
          is_active?: boolean
          main_count?: number
          name?: string
          price_cents?: number
          pricing_mode?: string
          rice_bowl_count?: number
          rice_count?: number
          side_count?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_catering: boolean
          item_type: string | null
          min_qty: number | null
          name: string
          price_cents: number | null
          sort_order: number
          sub_category_id: number | null
          updated_at: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_catering?: boolean
          item_type?: string | null
          min_qty?: number | null
          name: string
          price_cents?: number | null
          sort_order?: number
          sub_category_id?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_catering?: boolean
          item_type?: string | null
          min_qty?: number | null
          name?: string
          price_cents?: number | null
          sort_order?: number
          sub_category_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_options"
            referencedColumns: ["sub_category_id"]
          },
          {
            foreignKeyName: "menu_items_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          item_type: string | null
          meal_plan_id: number | null
          menu_item_id: string | null
          notes: string | null
          order_id: string
          plan_instance_id: string | null
          plan_type: string | null
          qty: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          item_type?: string | null
          meal_plan_id?: number | null
          menu_item_id?: string | null
          notes?: string | null
          order_id: string
          plan_instance_id?: string | null
          plan_type?: string | null
          qty?: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          item_type?: string | null
          meal_plan_id?: number | null
          menu_item_id?: string | null
          notes?: string | null
          order_id?: string
          plan_instance_id?: string | null
          plan_type?: string | null
          qty?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_options"
            referencedColumns: ["meal_plan_id"]
          },
          {
            foreignKeyName: "order_items_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_price_ranges"
            referencedColumns: ["meal_plan_id"]
          },
          {
            foreignKeyName: "order_items_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_options"
            referencedColumns: ["menu_item_id"]
          },
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          archived_at: string | null
          client_id: string | null
          created_at: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_date: string | null
          delivery_fee_cents: number
          delivery_time: string | null
          id: string
          notified_at: string | null
          order_ref: string
          order_type: Database["public"]["Enums"]["order_type"]
          payment_proof_url: string | null
          special_requests: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_fee_cents?: number
          delivery_time?: string | null
          id?: string
          notified_at?: string | null
          order_ref: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_proof_url?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          customer_email?: string
          customer_first_name?: string
          customer_last_name?: string
          customer_phone?: string
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_fee_cents?: number
          delivery_time?: string | null
          id?: string
          notified_at?: string | null
          order_ref?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_proof_url?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          conversation: Json
          created_at: string
          email: string
          event_date: string | null
          event_type: string | null
          id: string
          intents: string[]
          lead_level: string | null
          lead_priority: string | null
          lead_score: number
          name: string | null
          order_request: string | null
          pax: string | null
        }
        Insert: {
          conversation?: Json
          created_at?: string
          email: string
          event_date?: string | null
          event_type?: string | null
          id?: string
          intents?: string[]
          lead_level?: string | null
          lead_priority?: string | null
          lead_score?: number
          name?: string | null
          order_request?: string | null
          pax?: string | null
        }
        Update: {
          conversation?: Json
          created_at?: string
          email?: string
          event_date?: string | null
          event_type?: string | null
          id?: string
          intents?: string[]
          lead_level?: string | null
          lead_priority?: string | null
          lead_score?: number
          name?: string | null
          order_request?: string | null
          pax?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          description: string
          icon_id: string
          image_url: string | null
          is_active: boolean
          kind: string
          name: string
          page_title: string
          slug: string
          sort_order: number
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          description?: string
          icon_id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          name: string
          page_title: string
          slug: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          description?: string
          icon_id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          name?: string
          page_title?: string
          slug?: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sub_categories: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          name: string
          slot: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
          slot?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
          slot?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_daily_sales: {
        Row: {
          day: string | null
          orders: number | null
          sales_cents: number | null
        }
        Relationships: []
      }
      admin_order_stats: {
        Row: {
          archived_orders: number | null
          pending_orders: number | null
          today_orders: number | null
          total_orders: number | null
          total_sales_cents: number | null
        }
        Relationships: []
      }
      meal_plan_options: {
        Row: {
          description: string | null
          image_url: string | null
          meal_plan_id: number | null
          menu_item_id: string | null
          min_qty: number | null
          name: string | null
          price_cents: number | null
          slot: string | null
          sub_category_id: number | null
          sub_category_name: string | null
          sub_category_sort: number | null
        }
        Relationships: []
      }
      meal_plan_price_ranges: {
        Row: {
          max_cents: number | null
          meal_plan_id: number | null
          min_cents: number | null
          price_cents: number | null
          pricing_mode: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _contact_notify_post: {
        Args: {
          p_contact: Database["public"]["Tables"]["contact_submissions"]["Row"]
        }
        Returns: undefined
      }
      _notify_config: { Args: never; Returns: Record<string, unknown> }
      _order_notify_post: {
        Args: {
          p_kind: string
          p_order: Database["public"]["Tables"]["orders"]["Row"]
          p_to: string
        }
        Returns: undefined
      }
      _quote_notify_post: {
        Args: { p_quote: Database["public"]["Tables"]["quote_requests"]["Row"] }
        Returns: undefined
      }
      create_order: {
        Args: {
          p_customer: Json
          p_items: Json
          p_order_ref: string
          p_payment_proof_url?: string
          p_proof_ext?: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      submit_contact_message: {
        Args: {
          p_email: string
          p_first_name: string
          p_hp?: string
          p_last_name: string
          p_message: string
          p_topic: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "client" | "driver" | "admin"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "assigned"
        | "picked_up"
        | "delivered"
        | "cancelled"
      order_type: "delivery" | "pickup" | "catering"
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
      app_role: ["client", "driver", "admin"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "assigned",
        "picked_up",
        "delivered",
        "cancelled",
      ],
      order_type: ["delivery", "pickup", "catering"],
    },
  },
} as const
