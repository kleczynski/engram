// Generated from the Supabase schema. Regenerate after every migration:
//   supabase gen types typescript --project-id <ref> > utils/supabase/database.types.ts
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
      edges: {
        Row: {
          created_at: string | null
          edge_type: string
          id: string
          source_page_id: string | null
          target_page_id: string | null
        }
        Insert: {
          created_at?: string | null
          edge_type: string
          id?: string
          source_page_id?: string | null
          target_page_id?: string | null
        }
        Update: {
          created_at?: string | null
          edge_type?: string
          id?: string
          source_page_id?: string | null
          target_page_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edges_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edges_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          embedding: string | null
          page_id: string
          updated_at: string | null
        }
        Insert: {
          embedding?: string | null
          page_id: string
          updated_at?: string | null
        }
        Update: {
          embedding?: string | null
          page_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      link_suggestions: {
        Row: {
          confidence: number | null
          created_at: string | null
          from_page_id: string | null
          id: string
          reason: string | null
          status: string | null
          to_page_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          from_page_id?: string | null
          id?: string
          reason?: string | null
          status?: string | null
          to_page_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          from_page_id?: string | null
          id?: string
          reason?: string | null
          status?: string | null
          to_page_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_suggestions_from_page_id_fkey"
            columns: ["from_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_suggestions_to_page_id_fkey"
            columns: ["to_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content_hash: string | null
          created_at: string | null
          hub_score: number | null
          id: string
          last_edited_time: string | null
          last_synced_at: string | null
          lucid_url: string | null
          notion_id: string
          notion_url: string | null
          parent_notion_id: string | null
          relation_hash: string | null
          title: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          hub_score?: number | null
          id?: string
          last_edited_time?: string | null
          last_synced_at?: string | null
          lucid_url?: string | null
          notion_id: string
          notion_url?: string | null
          parent_notion_id?: string | null
          relation_hash?: string | null
          title: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          hub_score?: number | null
          id?: string
          last_edited_time?: string | null
          last_synced_at?: string | null
          lucid_url?: string | null
          notion_id?: string
          notion_url?: string | null
          parent_notion_id?: string | null
          relation_hash?: string | null
          title?: string
        }
        Relationships: []
      }
      rejected_links: {
        Row: {
          from_page_id: string
          rejected_at: string | null
          to_page_id: string
        }
        Insert: {
          from_page_id: string
          rejected_at?: string | null
          to_page_id: string
        }
        Update: {
          from_page_id?: string
          rejected_at?: string | null
          to_page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rejected_links_from_page_id_fkey"
            columns: ["from_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejected_links_to_page_id_fkey"
            columns: ["to_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          id: string
          pages_added: number | null
          pages_changed: number | null
          synced_at: string | null
        }
        Insert: {
          id?: string
          pages_added?: number | null
          pages_changed?: number | null
          synced_at?: string | null
        }
        Update: {
          id?: string
          pages_added?: number | null
          pages_changed?: number | null
          synced_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
