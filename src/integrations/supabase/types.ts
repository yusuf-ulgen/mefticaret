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
      abandoned_carts: {
        Row: {
          cart_token: string
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          id: string
          item_count: number
          items: Json
          last_seen_at: string
          recovered_order_id: string | null
          store_id: string
          total: number
          updated_at: string
        }
        Insert: {
          cart_token: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          item_count?: number
          items?: Json
          last_seen_at?: string
          recovered_order_id?: string | null
          store_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          cart_token?: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          item_count?: number
          items?: Json
          last_seen_at?: string
          recovered_order_id?: string | null
          store_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_recovered_order_id_fkey"
            columns: ["recovered_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abandoned_carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_impersonation_sessions: {
        Row: {
          admin_id: string
          ended_at: string | null
          id: string
          reason: string | null
          started_at: string
          store_id: string
        }
        Insert: {
          admin_id: string
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          store_id: string
        }
        Update: {
          admin_id?: string
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_impersonation_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_content_drafts: {
        Row: {
          applied_at: string | null
          content: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          fields: Json
          id: string
          kind: string
          status: string
          store_id: string
          title: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          fields?: Json
          id?: string
          kind: string
          status?: string
          store_id: string
          title?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          fields?: Json
          id?: string
          kind?: string
          status?: string
          store_id?: string
          title?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_drafts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          created_at: string
          duration_ms: number
          entity: string | null
          entity_id: string | null
          error: string | null
          id: string
          input_tokens: number
          meta: Json
          model: string
          output: string | null
          output_tokens: number
          prompt: string | null
          provider_code: string
          status: string
          store_id: string
          task: string
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          entity?: string | null
          entity_id?: string | null
          error?: string | null
          id?: string
          input_tokens?: number
          meta?: Json
          model: string
          output?: string | null
          output_tokens?: number
          prompt?: string | null
          provider_code?: string
          status?: string
          store_id: string
          task: string
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number
          entity?: string | null
          entity_id?: string | null
          error?: string | null
          id?: string
          input_tokens?: number
          meta?: Json
          model?: string
          output?: string | null
          output_tokens?: number
          prompt?: string | null
          provider_code?: string
          status?: string
          store_id?: string
          task?: string
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          api_key_secret_name: string | null
          code: string
          created_at: string
          default_model: string | null
          description: string | null
          id: string
          is_enabled: boolean
          models: Json
          name: string
          requires_api_key: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          code: string
          created_at?: string
          default_model?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          models?: Json
          name: string
          requires_api_key?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          code?: string
          created_at?: string
          default_model?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          models?: Json
          name?: string
          requires_api_key?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          campaign: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          device: string | null
          id: string
          kind: string
          medium: string | null
          order_id: string | null
          path: string | null
          product_id: string | null
          quantity: number
          referrer: string | null
          referrer_host: string | null
          search_results: number | null
          search_term: string | null
          session_id: string
          source: string | null
          store_id: string
          user_agent: string | null
          value: number
          variant_id: string | null
          visitor_id: string
        }
        Insert: {
          campaign?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          device?: string | null
          id?: string
          kind: string
          medium?: string | null
          order_id?: string | null
          path?: string | null
          product_id?: string | null
          quantity?: number
          referrer?: string | null
          referrer_host?: string | null
          search_results?: number | null
          search_term?: string | null
          session_id: string
          source?: string | null
          store_id: string
          user_agent?: string | null
          value?: number
          variant_id?: string | null
          visitor_id: string
        }
        Update: {
          campaign?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          device?: string | null
          id?: string
          kind?: string
          medium?: string | null
          order_id?: string | null
          path?: string | null
          product_id?: string | null
          quantity?: number
          referrer?: string | null
          referrer_host?: string | null
          search_results?: number | null
          search_term?: string | null
          session_id?: string
          source?: string | null
          store_id?: string
          user_agent?: string | null
          value?: number
          variant_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          api_version: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          request_count: number
          revoked_at: string | null
          scopes: string[]
          store_id: string
          updated_at: string
        }
        Insert: {
          api_version?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          request_count?: number
          revoked_at?: string | null
          scopes?: string[]
          store_id: string
          updated_at?: string
        }
        Update: {
          api_version?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          request_count?: number
          revoked_at?: string | null
          scopes?: string[]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          api_version: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          path: string
          status_code: number
          store_id: string
        }
        Insert: {
          api_key_id?: string | null
          api_version?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          path: string
          status_code?: number
          store_id: string
        }
        Update: {
          api_key_id?: string | null
          api_version?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          path?: string
          status_code?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      app_installations: {
        Row: {
          app_id: string
          created_at: string
          granted_permissions: string[]
          id: string
          installed_at: string
          installed_by: string | null
          settings: Json
          status: Database["public"]["Enums"]["app_install_status"]
          store_id: string
          uninstalled_at: string | null
          updated_at: string
        }
        Insert: {
          app_id: string
          created_at?: string
          granted_permissions?: string[]
          id?: string
          installed_at?: string
          installed_by?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["app_install_status"]
          store_id: string
          uninstalled_at?: string | null
          updated_at?: string
        }
        Update: {
          app_id?: string
          created_at?: string
          granted_permissions?: string[]
          id?: string
          installed_at?: string
          installed_by?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["app_install_status"]
          store_id?: string
          uninstalled_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_installations_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_installations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      app_permissions: {
        Row: {
          app_id: string
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          label: string
          scope: string
        }
        Insert: {
          app_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label: string
          scope: string
        }
        Update: {
          app_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          label?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_permissions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      apps: {
        Row: {
          category: Database["public"]["Enums"]["app_category"]
          code: string
          created_at: string
          currency: string
          description: string | null
          developer: string
          developer_url: string | null
          id: string
          install_count: number
          is_active: boolean
          is_featured: boolean
          logo_emoji: string | null
          logo_url: string | null
          name: string
          permissions: string[]
          price: number
          pricing_model: Database["public"]["Enums"]["app_pricing_model"]
          rating: number
          settings_schema: Json
          sort_order: number
          tagline: string | null
          updated_at: string
          version: string
        }
        Insert: {
          category: Database["public"]["Enums"]["app_category"]
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          developer?: string
          developer_url?: string | null
          id?: string
          install_count?: number
          is_active?: boolean
          is_featured?: boolean
          logo_emoji?: string | null
          logo_url?: string | null
          name: string
          permissions?: string[]
          price?: number
          pricing_model?: Database["public"]["Enums"]["app_pricing_model"]
          rating?: number
          settings_schema?: Json
          sort_order?: number
          tagline?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["app_category"]
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          developer?: string
          developer_url?: string | null
          id?: string
          install_count?: number
          is_active?: boolean
          is_featured?: boolean
          logo_emoji?: string | null
          logo_url?: string | null
          name?: string
          permissions?: string[]
          price?: number
          pricing_model?: Database["public"]["Enums"]["app_pricing_model"]
          rating?: number
          settings_schema?: Json
          sort_order?: number
          tagline?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip: string | null
          new_value: Json | null
          old_value: Json | null
          store_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          store_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          store_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_run_events: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["automation_step_kind"]
          message: string | null
          outcome: string
          run_id: string
          step_id: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["automation_step_kind"]
          message?: string | null
          outcome?: string
          run_id: string
          step_id?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["automation_step_kind"]
          message?: string | null
          outcome?: string
          run_id?: string
          step_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_run_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_run_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          cart_id: string | null
          completed_at: string | null
          context: Json
          created_at: string
          current_position: number
          customer_id: string | null
          id: string
          last_error: string | null
          next_run_at: string
          order_id: string | null
          status: Database["public"]["Enums"]["automation_run_status"]
          store_id: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          cart_id?: string | null
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_position?: number
          customer_id?: string | null
          id?: string
          last_error?: string | null
          next_run_at?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["automation_run_status"]
          store_id: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          cart_id?: string | null
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_position?: number
          customer_id?: string | null
          id?: string
          last_error?: string | null
          next_run_at?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["automation_run_status"]
          store_id?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          condition_kind:
            | Database["public"]["Enums"]["automation_condition"]
            | null
          config: Json
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["automation_step_kind"]
          on_false: string
          on_true: string
          position: number
          store_id: string
          template_id: string | null
          title: string | null
          updated_at: string
          wait_minutes: number
          workflow_id: string
        }
        Insert: {
          condition_kind?:
            | Database["public"]["Enums"]["automation_condition"]
            | null
          config?: Json
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["automation_step_kind"]
          on_false?: string
          on_true?: string
          position?: number
          store_id: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          wait_minutes?: number
          workflow_id: string
        }
        Update: {
          condition_kind?:
            | Database["public"]["Enums"]["automation_condition"]
            | null
          config?: Json
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["automation_step_kind"]
          on_false?: string
          on_true?: string
          position?: number
          store_id?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          wait_minutes?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflows: {
        Row: {
          canvas: Json
          completed_count: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          messages_sent: number
          name: string
          runs_count: number
          store_id: string
          trigger_event: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
        }
        Insert: {
          canvas?: Json
          completed_count?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          messages_sent?: number
          name: string
          runs_count?: number
          store_id: string
          trigger_event: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Update: {
          canvas?: Json
          completed_count?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          messages_sent?: number
          name?: string
          runs_count?: number
          store_id?: string
          trigger_event?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflows_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          amount_due: number
          closed_at: string | null
          created_at: string
          currency: string
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["billing_cycle_status"]
          store_id: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount_due?: number
          closed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["billing_cycle_status"]
          store_id: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          closed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["billing_cycle_status"]
          store_id?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_cycles_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          slug: string
          store_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          slug: string
          store_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          slug?: string
          store_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_authors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cache_entries: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          namespace: string
          store_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          namespace: string
          store_id?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          namespace?: string
          store_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cache_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          image_url: string | null
          line_total: number
          product_id: string | null
          quantity: number
          sku: string | null
          store_id: string
          title: string
          unit_price: number
          updated_at: string
          variant_id: string | null
          variant_title: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          line_total?: number
          product_id?: string | null
          quantity?: number
          sku?: string | null
          store_id: string
          title: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
          variant_title?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          line_total?: number
          product_id?: string | null
          quantity?: number
          sku?: string | null
          store_id?: string
          title?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          abandoned_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          customer_id: string | null
          discount_code: string | null
          discount_total: number
          grand_total: number
          id: string
          note: string | null
          session_token: string | null
          shipping_total: number
          store_id: string
          subtotal: number
          tax_total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          abandoned_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_code?: string | null
          discount_total?: number
          grand_total?: number
          id?: string
          note?: string | null
          session_token?: string | null
          shipping_total?: number
          store_id: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          abandoned_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_code?: string | null
          discount_total?: number
          grand_total?: number
          id?: string
          note?: string | null
          session_token?: string | null
          shipping_total?: number
          store_id?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          level: number
          name: string
          parent_id: string | null
          path: string | null
          seo: Json
          slug: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: number
          name: string
          parent_id?: string | null
          path?: string | null
          seo?: Json
          slug: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: number
          name?: string
          parent_id?: string | null
          path?: string | null
          seo?: Json
          slug?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_listings: {
        Row: {
          channel_id: string
          created_at: string
          external_id: string | null
          external_url: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          price_override: number | null
          product_id: string
          status: Database["public"]["Enums"]["listing_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          price_override?: number | null
          product_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          price_override?: number | null
          product_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_listings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketplace_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_listings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          seo: Json
          slug: string
          sort_order: number
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          seo?: Json
          slug: string
          sort_order?: number
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          seo?: Json
          slug?: string
          sort_order?: number
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          base_amount: number
          commission_amount: number
          created_at: string
          currency: string
          id: string
          order_id: string | null
          order_item_id: string | null
          rate: number
          seller_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          base_amount?: number
          commission_amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          order_item_id?: string | null
          rate?: number
          seller_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          order_item_id?: string | null
          rate?: number
          seller_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_price_history: {
        Row: {
          checked_at: string
          competitor_id: string
          currency: string
          id: string
          price: number
          store_id: string
        }
        Insert: {
          checked_at?: string
          competitor_id: string
          currency?: string
          id?: string
          price: number
          store_id: string
        }
        Update: {
          checked_at?: string
          competitor_id?: string
          currency?: string
          id?: string
          price?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_price_history_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_price_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_products: {
        Row: {
          ai_analysis: string | null
          ai_summary: Json
          alert_threshold_pct: number
          competitor_category: string | null
          competitor_description: string | null
          competitor_price: number | null
          competitor_title: string | null
          content_score: number | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          last_checked_at: string | null
          last_price_change_at: string | null
          name: string
          previous_price: number | null
          product_id: string | null
          serp_position: number | null
          source: string
          store_id: string
          updated_at: string
          url: string | null
          visibility_score: number | null
        }
        Insert: {
          ai_analysis?: string | null
          ai_summary?: Json
          alert_threshold_pct?: number
          competitor_category?: string | null
          competitor_description?: string | null
          competitor_price?: number | null
          competitor_title?: string | null
          content_score?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_price_change_at?: string | null
          name: string
          previous_price?: number | null
          product_id?: string | null
          serp_position?: number | null
          source?: string
          store_id: string
          updated_at?: string
          url?: string | null
          visibility_score?: number | null
        }
        Update: {
          ai_analysis?: string | null
          ai_summary?: Json
          alert_threshold_pct?: number
          competitor_category?: string | null
          competitor_description?: string | null
          competitor_price?: number | null
          competitor_title?: string | null
          content_score?: number | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_price_change_at?: string | null
          name?: string
          previous_price?: number | null
          product_id?: string | null
          serp_position?: number | null
          source?: string
          store_id?: string
          updated_at?: string
          url?: string | null
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      connectors: {
        Row: {
          code: string
          config_fields: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["connector_kind"]
          logo_url: string | null
          name: string
          sort_order: number
          supports_installments: boolean
          supports_test_mode: boolean
          updated_at: string
        }
        Insert: {
          code: string
          config_fields?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["connector_kind"]
          logo_url?: string | null
          name: string
          sort_order?: number
          supports_installments?: boolean
          supports_test_mode?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          config_fields?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["connector_kind"]
          logo_url?: string | null
          name?: string
          sort_order?: number
          supports_installments?: boolean
          supports_test_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          consent_type: string
          created_at: string
          customer_id: string | null
          granted: boolean
          id: string
          ip: string | null
          meta: Json
          policy_version: string
          source: string
          store_id: string | null
          subject_email: string | null
          subject_token: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          consent_type: string
          created_at?: string
          customer_id?: string | null
          granted?: boolean
          id?: string
          ip?: string | null
          meta?: Json
          policy_version?: string
          source?: string
          store_id?: string | null
          subject_email?: string | null
          subject_token?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          consent_type?: string
          created_at?: string
          customer_id?: string | null
          granted?: boolean
          id?: string
          ip?: string | null
          meta?: Json
          policy_version?: string
          source?: string
          store_id?: string | null
          subject_email?: string | null
          subject_token?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          store_id: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          store_id: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          store_id?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          content: string
          context_summary: Json
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          role: string
          store_id: string
          total_tokens: number
        }
        Insert: {
          content: string
          context_summary?: Json
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          role: string
          store_id: string
          total_tokens?: number
        }
        Update: {
          content?: string
          context_summary?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          role?: string
          store_id?: string
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "copilot_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_rates: {
        Row: {
          base_currency: string
          created_at: string
          fetched_at: string
          id: string
          quote_currency: string
          rate: number
          source: string
          store_id: string
          updated_at: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          fetched_at?: string
          id?: string
          quote_currency: string
          rate?: number
          source?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          quote_currency?: string
          rate?: number
          source?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string | null
          country: string
          created_at: string
          customer_id: string
          district: string | null
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          phone: string | null
          postal_code: string | null
          recipient: string
          store_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          customer_id: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          phone?: string | null
          postal_code?: string | null
          recipient: string
          store_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          customer_id?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          phone?: string | null
          postal_code?: string | null
          recipient?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          inactive_days: number | null
          is_system: boolean
          min_orders: number
          min_spent: number
          name: string
          new_within_days: number | null
          required_tags: string[]
          slug: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          inactive_days?: number | null
          is_system?: boolean
          min_orders?: number
          min_spent?: number
          name: string
          new_within_days?: number | null
          required_tags?: string[]
          slug: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          inactive_days?: number | null
          is_system?: boolean
          min_orders?: number
          min_spent?: number
          name?: string
          new_within_days?: number | null
          required_tags?: string[]
          slug?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_segments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          store_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          store_id: string
          tag: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          store_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          accepts_marketing: boolean
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string
          id: string
          last_activity_at: string | null
          last_name: string | null
          notes: string | null
          orders_count: number
          phone: string | null
          store_id: string
          tags: string[]
          total_spent: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepts_marketing?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          last_activity_at?: string | null
          last_name?: string | null
          notes?: string | null
          orders_count?: number
          phone?: string | null
          store_id: string
          tags?: string[]
          total_spent?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepts_marketing?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_activity_at?: string | null
          last_name?: string | null
          notes?: string | null
          orders_count?: number
          phone?: string | null
          store_id?: string
          tags?: string[]
          total_spent?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      data_processing_records: {
        Row: {
          activity: string
          created_at: string
          cross_border_transfer: boolean
          data_categories: string[]
          data_subjects: string[]
          id: string
          legal_basis: string
          purpose: string
          recipients: string[]
          responsible_person: string | null
          retention_period: string | null
          security_measures: string | null
          store_id: string
          transfer_details: string | null
          updated_at: string
        }
        Insert: {
          activity: string
          created_at?: string
          cross_border_transfer?: boolean
          data_categories?: string[]
          data_subjects?: string[]
          id?: string
          legal_basis?: string
          purpose: string
          recipients?: string[]
          responsible_person?: string | null
          retention_period?: string | null
          security_measures?: string | null
          store_id: string
          transfer_details?: string | null
          updated_at?: string
        }
        Update: {
          activity?: string
          created_at?: string
          cross_border_transfer?: boolean
          data_categories?: string[]
          data_subjects?: string[]
          id?: string
          legal_basis?: string
          purpose?: string
          recipients?: string[]
          responsible_person?: string | null
          retention_period?: string | null
          security_measures?: string | null
          store_id?: string
          transfer_details?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_processing_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_id: string | null
          handled_by: string | null
          id: string
          kind: string
          reason: string | null
          result_meta: Json
          result_path: string | null
          status: string
          store_id: string | null
          subject_email: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          reason?: string | null
          result_meta?: Json
          result_path?: string | null
          status?: string
          store_id?: string | null
          subject_email: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          reason?: string | null
          result_meta?: Json
          result_path?: string | null
          status?: string
          store_id?: string | null
          subject_email?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          discount_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          per_customer_limit: number | null
          store_id: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          per_customer_limit?: number | null
          store_id: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          per_customer_limit?: number | null
          store_id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          code: string
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          min_subtotal: number
          starts_at: string
          store_id: string
          title: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal?: number
          starts_at?: string
          store_id: string
          title?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal?: number
          starts_at?: string
          store_id?: string
          title?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      dropship_orders: {
        Row: {
          carrier: string | null
          created_at: string
          error: string | null
          external_ref: string | null
          id: string
          order_id: string
          payload: Json
          response: Json | null
          sent_at: string | null
          status: Database["public"]["Enums"]["dropship_order_status"]
          store_id: string
          supplier_id: string | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          error?: string | null
          external_ref?: string | null
          id?: string
          order_id: string
          payload?: Json
          response?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["dropship_order_status"]
          store_id: string
          supplier_id?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          error?: string | null
          external_ref?: string | null
          id?: string
          order_id?: string
          payload?: Json
          response?: Json | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["dropship_order_status"]
          store_id?: string
          supplier_id?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dropship_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropship_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropship_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_history: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          new_rate: number
          old_rate: number | null
          provider_code: string | null
          quote_currency: string
          source: string
          store_id: string | null
        }
        Insert: {
          base_currency: string
          created_at?: string
          id?: string
          new_rate: number
          old_rate?: number | null
          provider_code?: string | null
          quote_currency: string
          source?: string
          store_id?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          new_rate?: number
          old_rate?: number | null
          provider_code?: string | null
          quote_currency?: string
          source?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rate_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_providers: {
        Row: {
          adapter: string
          base_url: string | null
          code: string
          created_at: string
          failure_count: number
          id: string
          is_active: boolean
          last_error: string | null
          last_status: string | null
          last_success_at: string | null
          name: string
          priority: number
          requires_key: boolean
          secret_name: string | null
          updated_at: string
        }
        Insert: {
          adapter: string
          base_url?: string | null
          code: string
          created_at?: string
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_status?: string | null
          last_success_at?: string | null
          name: string
          priority?: number
          requires_key?: boolean
          secret_name?: string | null
          updated_at?: string
        }
        Update: {
          adapter?: string
          base_url?: string | null
          code?: string
          created_at?: string
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_status?: string | null
          last_success_at?: string | null
          name?: string
          priority?: number
          requires_key?: boolean
          secret_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fb_marketplace_accounts: {
        Row: {
          auto_sync: boolean
          catalog_id: string | null
          created_at: string
          currency: string
          default_category: string | null
          default_condition: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          offer_local_pickup: boolean
          offer_shipping: boolean
          page_id: string
          page_name: string | null
          partner_id: string | null
          settings: Json
          status: Database["public"]["Enums"]["channel_status"]
          store_id: string
          sync_interval_minutes: number
          updated_at: string
        }
        Insert: {
          auto_sync?: boolean
          catalog_id?: string | null
          created_at?: string
          currency?: string
          default_category?: string | null
          default_condition?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          offer_local_pickup?: boolean
          offer_shipping?: boolean
          page_id: string
          page_name?: string | null
          partner_id?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["channel_status"]
          store_id: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          auto_sync?: boolean
          catalog_id?: string | null
          created_at?: string
          currency?: string
          default_category?: string | null
          default_condition?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          offer_local_pickup?: boolean
          offer_shipping?: boolean
          page_id?: string
          page_name?: string | null
          partner_id?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["channel_status"]
          store_id?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_marketplace_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_marketplace_credentials: {
        Row: {
          access_token: string
          account_id: string
          created_at: string
          expires_at: string | null
          id: string
          store_id: string
          token_type: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          store_id: string
          token_type?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          store_id?: string
          token_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_marketplace_credentials_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "fb_marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_marketplace_credentials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_marketplace_listings: {
        Row: {
          account_id: string
          created_at: string
          fb_item_id: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          payload: Json
          payload_hash: string | null
          price: number | null
          product_id: string
          quantity: number
          retailer_id: string
          status: Database["public"]["Enums"]["listing_status"]
          store_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          fb_item_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          payload?: Json
          payload_hash?: string | null
          price?: number | null
          product_id: string
          quantity?: number
          retailer_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          store_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          fb_item_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          payload?: Json
          payload_hash?: string | null
          price?: number | null
          product_id?: string
          quantity?: number
          retailer_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          store_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_marketplace_listings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fb_marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_marketplace_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_marketplace_listings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_marketplace_listings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_marketplace_sync_runs: {
        Row: {
          account_id: string
          created_at: string
          created_items: number
          deleted_items: number
          error: string | null
          failed_items: number
          finished_at: string | null
          id: string
          started_at: string
          status: string
          store_id: string
          total_items: number
          trigger_source: string
          updated_at: string
          updated_items: number
        }
        Insert: {
          account_id: string
          created_at?: string
          created_items?: number
          deleted_items?: number
          error?: string | null
          failed_items?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          store_id: string
          total_items?: number
          trigger_source?: string
          updated_at?: string
          updated_items?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          created_items?: number
          deleted_items?: number
          error?: string | null
          failed_items?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          store_id?: string
          total_items?: number
          trigger_source?: string
          updated_at?: string
          updated_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "fb_marketplace_sync_runs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fb_marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_marketplace_sync_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          gift_card_id: string
          id: string
          kind: string
          note: string | null
          order_id: string | null
          store_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          gift_card_id: string
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          gift_card_id?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          balance: number
          code: string
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          expires_at: string | null
          id: string
          initial_amount: number
          note: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          balance: number
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          expires_at?: string | null
          id?: string
          initial_amount: number
          note?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          expires_at?: string | null
          id?: string
          initial_amount?: number
          note?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          ai_confidence_threshold: number
          auto_comment_dm_enabled: boolean
          autonomous_ai_enabled: boolean
          created_at: string
          id: string
          ig_user_id: string
          ig_username: string | null
          page_id: string | null
          page_name: string | null
          scopes: string[]
          status: string
          status_message: string | null
          store_id: string
          token_expires_at: string | null
          updated_at: string
          verify_token: string
        }
        Insert: {
          ai_confidence_threshold?: number
          auto_comment_dm_enabled?: boolean
          autonomous_ai_enabled?: boolean
          created_at?: string
          id?: string
          ig_user_id: string
          ig_username?: string | null
          page_id?: string | null
          page_name?: string | null
          scopes?: string[]
          status?: string
          status_message?: string | null
          store_id: string
          token_expires_at?: string | null
          updated_at?: string
          verify_token?: string
        }
        Update: {
          ai_confidence_threshold?: number
          auto_comment_dm_enabled?: boolean
          autonomous_ai_enabled?: boolean
          created_at?: string
          id?: string
          ig_user_id?: string
          ig_username?: string | null
          page_id?: string | null
          page_name?: string | null
          scopes?: string[]
          status?: string
          status_message?: string | null
          store_id?: string
          token_expires_at?: string | null
          updated_at?: string
          verify_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_comment_rules: {
        Row: {
          conversion_count: number
          created_at: string
          dm_sent_count: number
          dm_template: string
          id: string
          is_active: boolean
          keywords: string[]
          match_type: string
          name: string
          priority: number
          product_id: string | null
          public_reply: string
          reply_to_comment: boolean
          send_product_card: boolean
          store_id: string
          target_post_id: string | null
          triggered_count: number
          updated_at: string
        }
        Insert: {
          conversion_count?: number
          created_at?: string
          dm_sent_count?: number
          dm_template?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_type?: string
          name: string
          priority?: number
          product_id?: string | null
          public_reply?: string
          reply_to_comment?: boolean
          send_product_card?: boolean
          store_id: string
          target_post_id?: string | null
          triggered_count?: number
          updated_at?: string
        }
        Update: {
          conversion_count?: number
          created_at?: string
          dm_sent_count?: number
          dm_template?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_type?: string
          name?: string
          priority?: number
          product_id?: string | null
          public_reply?: string
          reply_to_comment?: boolean
          send_product_card?: boolean
          store_id?: string
          target_post_id?: string | null
          triggered_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_comment_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_comment_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_credentials: {
        Row: {
          access_token: string
          account_id: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_credentials_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_credentials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_events: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event_type: string
          external_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          status: string
          store_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          store_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_interactions: {
        Row: {
          comment_id: string | null
          conversation_id: string | null
          created_at: string
          dm_status: string
          error: string | null
          id: string
          ig_user_id: string | null
          kind: string
          matched_keyword: string | null
          post_id: string | null
          reply_status: string
          rule_id: string | null
          store_id: string
          text: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          dm_status?: string
          error?: string | null
          id?: string
          ig_user_id?: string | null
          kind?: string
          matched_keyword?: string | null
          post_id?: string | null
          reply_status?: string
          rule_id?: string | null
          store_id: string
          text?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          dm_status?: string
          error?: string | null
          id?: string
          ig_user_id?: string | null
          kind?: string
          matched_keyword?: string | null
          post_id?: string | null
          reply_status?: string
          rule_id?: string | null
          store_id?: string
          text?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_interactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "omni_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_interactions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "instagram_comment_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_interactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          available: number | null
          bin_location: string | null
          created_at: string
          external_ref: string | null
          external_source: string | null
          id: string
          incoming: number
          last_synced_at: string | null
          min_stock: number
          on_hand: number
          product_id: string | null
          reserved: number
          store_id: string
          updated_at: string
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          available?: number | null
          bin_location?: string | null
          created_at?: string
          external_ref?: string | null
          external_source?: string | null
          id?: string
          incoming?: number
          last_synced_at?: string | null
          min_stock?: number
          on_hand?: number
          product_id?: string | null
          reserved?: number
          store_id: string
          updated_at?: string
          variant_id: string
          warehouse_id: string
        }
        Update: {
          available?: number | null
          bin_location?: string | null
          created_at?: string
          external_ref?: string | null
          external_source?: string | null
          id?: string
          incoming?: number
          last_synced_at?: string | null
          min_stock?: number
          on_hand?: number
          product_id?: string | null
          reserved?: number
          store_id?: string
          updated_at?: string
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["inventory_movement_kind"]
          product_id: string | null
          quantity: number
          reason: string | null
          stock_after: number
          stock_before: number
          store_id: string
          target_warehouse_id: string | null
          transfer_id: string | null
          variant_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["inventory_movement_kind"]
          product_id?: string | null
          quantity: number
          reason?: string | null
          stock_after?: number
          stock_before?: number
          store_id: string
          target_warehouse_id?: string | null
          transfer_id?: string | null
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["inventory_movement_kind"]
          product_id?: string | null
          quantity?: number
          reason?: string | null
          stock_after?: number
          stock_before?: number
          store_id?: string
          target_warehouse_id?: string | null
          transfer_id?: string | null
          variant_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_target_warehouse_id_fkey"
            columns: ["target_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_transfer_fk"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_cycle_id: string | null
          created_at: string
          currency: string
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          line_items: Json
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          store_id: string
          subscription_id: string | null
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          billing_cycle_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          line_items?: Json
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          store_id: string
          subscription_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          billing_cycle_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          line_items?: Json
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          store_id?: string
          subscription_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          finished_at: string | null
          id: string
          kind: Database["public"]["Enums"]["job_kind"]
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          priority: number
          result: Json | null
          run_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          finished_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["job_kind"]
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          result?: Json | null
          run_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          finished_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["job_kind"]
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          result?: Json | null
          run_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          code: string | null
          created_at: string
          currency: string
          customer_id: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["ledger_account_kind"]
          meta: Json
          name: string
          seller_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["ledger_account_kind"]
          meta?: Json
          name: string
          seller_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["ledger_account_kind"]
          meta?: Json
          name?: string
          seller_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_accounts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string | null
          amount: number
          counter_account_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          description: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          id: string
          kind: Database["public"]["Enums"]["ledger_entry_kind"]
          meta: Json
          occurred_at: string
          order_id: string | null
          payout_id: string | null
          reference: string | null
          reverses_entry_id: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["ledger_entry_status"]
          store_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          counter_account_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          kind: Database["public"]["Enums"]["ledger_entry_kind"]
          meta?: Json
          occurred_at?: string
          order_id?: string | null
          payout_id?: string | null
          reference?: string | null
          reverses_entry_id?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["ledger_entry_status"]
          store_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          counter_account_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          kind?: Database["public"]["Enums"]["ledger_entry_kind"]
          meta?: Json
          occurred_at?: string
          order_id?: string | null
          payout_id?: string | null
          reference?: string | null
          reverses_entry_id?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["ledger_entry_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_counter_account_id_fkey"
            columns: ["counter_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payout_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      market_countries: {
        Row: {
          country_code: string
          created_at: string
          id: string
          market_id: string
          store_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          market_id: string
          store_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          market_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_countries_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_countries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_channels: {
        Row: {
          auto_sync: boolean
          config_ref: string | null
          created_at: string
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          name: string
          price_markup_rate: number
          provider: string
          seller_id: string | null
          status: Database["public"]["Enums"]["channel_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          auto_sync?: boolean
          config_ref?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          price_markup_rate?: number
          provider: string
          seller_id?: string | null
          status?: Database["public"]["Enums"]["channel_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          auto_sync?: boolean
          config_ref?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          price_markup_rate?: number
          provider?: string
          seller_id?: string | null
          status?: Database["public"]["Enums"]["channel_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_channels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listing_links: {
        Row: {
          channel_id: string
          created_at: string
          error: string | null
          external_barcode: string | null
          external_listing_id: string | null
          id: string
          price: number | null
          product_id: string
          status: string
          stock_multiplier: number
          store_id: string
          title: string | null
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          error?: string | null
          external_barcode?: string | null
          external_listing_id?: string | null
          id?: string
          price?: number | null
          product_id: string
          status?: string
          stock_multiplier?: number
          store_id: string
          title?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          error?: string | null
          external_barcode?: string | null
          external_listing_id?: string | null
          id?: string
          price?: number | null
          product_id?: string
          status?: string
          stock_multiplier?: number
          store_id?: string
          title?: string | null
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_links_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketplace_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listing_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listing_links_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listing_links_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_returns: {
        Row: {
          auto_restock: boolean
          channel_id: string | null
          created_at: string
          currency: string
          customer_name: string | null
          external_order_number: string | null
          external_return_id: string | null
          id: string
          is_exchange: boolean
          items: Json
          marketplace: string
          order_id: string | null
          reason: string | null
          reason_detail: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          restocked_at: string | null
          staff_note: string | null
          status: string
          store_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          auto_restock?: boolean
          channel_id?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          external_order_number?: string | null
          external_return_id?: string | null
          id?: string
          is_exchange?: boolean
          items?: Json
          marketplace: string
          order_id?: string | null
          reason?: string | null
          reason_detail?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          restocked_at?: string | null
          staff_note?: string | null
          status?: string
          store_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          auto_restock?: boolean
          channel_id?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          external_order_number?: string | null
          external_return_id?: string | null
          id?: string
          is_exchange?: boolean
          items?: Json
          marketplace?: string
          order_id?: string | null
          reason?: string | null
          reason_detail?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          restocked_at?: string | null
          staff_note?: string | null
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_returns_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketplace_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sellers: {
        Row: {
          about: string | null
          approved_at: string | null
          commission_rate: number
          created_at: string
          display_name: string
          email: string | null
          iban: string | null
          id: string
          legal_name: string | null
          phone: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["seller_status"]
          store_id: string
          suspended_at: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          about?: string | null
          approved_at?: string | null
          commission_rate?: number
          created_at?: string
          display_name: string
          email?: string | null
          iban?: string | null
          id?: string
          legal_name?: string | null
          phone?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          store_id: string
          suspended_at?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          about?: string | null
          approved_at?: string | null
          commission_rate?: number
          created_at?: string
          display_name?: string
          email?: string | null
          iban?: string | null
          id?: string
          legal_name?: string | null
          phone?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          store_id?: string
          suspended_at?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sellers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_settlements: {
        Row: {
          channel_id: string | null
          commission_amount: number
          created_at: string
          currency: string
          external_id: string | null
          gross_amount: number
          id: string
          marketplace: string
          net_amount: number
          other_deductions: number
          paid_at: string | null
          period_end: string
          period_start: string
          service_fee: number
          shipping_amount: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          external_id?: string | null
          gross_amount?: number
          id?: string
          marketplace: string
          net_amount?: number
          other_deductions?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          service_fee?: number
          shipping_amount?: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          external_id?: string | null
          gross_amount?: number
          id?: string
          marketplace?: string
          net_amount?: number
          other_deductions?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          service_fee?: number
          shipping_amount?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_settlements_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketplace_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_settlements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          code: string
          country_code: string
          created_at: string
          currency: string
          domain: string | null
          id: string
          is_active: boolean
          is_default: boolean
          locale: string | null
          markup_type: Database["public"]["Enums"]["markup_type"]
          markup_value: number
          name: string
          payment_method_ids: string[]
          price_list_id: string | null
          rounding: Database["public"]["Enums"]["rounding_mode"]
          shipping_zone_ids: string[]
          sort_order: number
          store_id: string
          tax_class_id: string | null
          tax_included: boolean
          updated_at: string
          url_prefix: string | null
        }
        Insert: {
          code: string
          country_code: string
          created_at?: string
          currency: string
          domain?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          locale?: string | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          markup_value?: number
          name: string
          payment_method_ids?: string[]
          price_list_id?: string | null
          rounding?: Database["public"]["Enums"]["rounding_mode"]
          shipping_zone_ids?: string[]
          sort_order?: number
          store_id: string
          tax_class_id?: string | null
          tax_included?: boolean
          updated_at?: string
          url_prefix?: string | null
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string
          currency?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          locale?: string | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          markup_value?: number
          name?: string
          payment_method_ids?: string[]
          price_list_id?: string | null
          rounding?: Database["public"]["Enums"]["rounding_mode"]
          shipping_zone_ids?: string[]
          sort_order?: number
          store_id?: string
          tax_class_id?: string | null
          tax_included?: boolean
          updated_at?: string
          url_prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markets_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_tax_class_id_fkey"
            columns: ["tax_class_id"]
            isOneToOne: false
            referencedRelation: "tax_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt: string | null
          bucket: string
          caption: string | null
          checksum: string | null
          converted_to_webp: boolean
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          extension: string | null
          file_name: string
          folder_id: string | null
          height: number | null
          id: string
          kind: string
          mime_type: string
          optimized: boolean
          original_size_bytes: number | null
          public_url: string | null
          size_bytes: number
          storage_path: string
          storage_provider: string
          store_id: string
          tags: string[]
          title: string | null
          updated_at: string
          usage_count: number
          variants: Json
          width: number | null
        }
        Insert: {
          alt?: string | null
          bucket?: string
          caption?: string | null
          checksum?: string | null
          converted_to_webp?: boolean
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          extension?: string | null
          file_name: string
          folder_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type: string
          optimized?: boolean
          original_size_bytes?: number | null
          public_url?: string | null
          size_bytes?: number
          storage_path: string
          storage_provider?: string
          store_id: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          usage_count?: number
          variants?: Json
          width?: number | null
        }
        Update: {
          alt?: string | null
          bucket?: string
          caption?: string | null
          checksum?: string | null
          converted_to_webp?: boolean
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          extension?: string | null
          file_name?: string
          folder_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string
          optimized?: boolean
          original_size_bytes?: number | null
          public_url?: string | null
          size_bytes?: number
          storage_path?: string
          storage_provider?: string
          store_id?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          usage_count?: number
          variants?: Json
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          path: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          path?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_folders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          handle: string
          id: string
          is_active: boolean
          location: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          is_active?: boolean
          location?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          is_active?: boolean
          location?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deliveries: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          customer_id: string | null
          error: string | null
          id: string
          provider_message_id: string | null
          recipient: string
          run_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_delivery_status"]
          store_id: string
          subject: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          customer_id?: string | null
          error?: string | null
          id?: string
          provider_message_id?: string | null
          recipient: string
          run_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_delivery_status"]
          store_id: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          customer_id?: string | null
          error?: string | null
          id?: string
          provider_message_id?: string | null
          recipient?: string
          run_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_delivery_status"]
          store_id?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          store_id: string
          subject: string | null
          updated_at: string
          variables: Json
          whatsapp_language: string
          whatsapp_template_name: string | null
        }
        Insert: {
          body?: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          store_id: string
          subject?: string | null
          updated_at?: string
          variables?: Json
          whatsapp_language?: string
          whatsapp_template_name?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          store_id?: string
          subject?: string | null
          updated_at?: string
          variables?: Json
          whatsapp_language?: string
          whatsapp_template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          email: boolean
          email_to: string | null
          id: string
          in_app: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          push: boolean
          sms: boolean
          sms_to: string | null
          store_id: string
          updated_at: string
          whatsapp: boolean
          whatsapp_to: string | null
        }
        Insert: {
          created_at?: string
          email?: boolean
          email_to?: string | null
          id?: string
          in_app?: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          push?: boolean
          sms?: boolean
          sms_to?: string | null
          store_id: string
          updated_at?: string
          whatsapp?: boolean
          whatsapp_to?: string | null
        }
        Update: {
          created_at?: string
          email?: boolean
          email_to?: string | null
          id?: string
          in_app?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          push?: boolean
          sms?: boolean
          sms_to?: string | null
          store_id?: string
          updated_at?: string
          whatsapp?: boolean
          whatsapp_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          is_read: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          message: string | null
          meta: Json
          store_id: string
          title: string
        }
        Insert: {
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          is_read?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          message?: string | null
          meta?: Json
          store_id: string
          title: string
        }
        Update: {
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          is_read?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          message?: string | null
          meta?: Json
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_access_tokens: {
        Row: {
          api_version: string
          client_id: string
          created_at: string
          expires_at: string
          grant_type: string
          id: string
          last_used_at: string | null
          refresh_expires_at: string | null
          refresh_token_hash: string | null
          request_count: number
          revoked_at: string | null
          scopes: string[]
          store_id: string | null
          token_hash: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_version?: string
          client_id: string
          created_at?: string
          expires_at: string
          grant_type?: string
          id?: string
          last_used_at?: string | null
          refresh_expires_at?: string | null
          refresh_token_hash?: string | null
          request_count?: number
          revoked_at?: string | null
          scopes?: string[]
          store_id?: string | null
          token_hash: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_version?: string
          client_id?: string
          created_at?: string
          expires_at?: string
          grant_type?: string
          id?: string
          last_used_at?: string | null
          refresh_expires_at?: string | null
          refresh_token_hash?: string | null
          request_count?: number
          revoked_at?: string | null
          scopes?: string[]
          store_id?: string | null
          token_hash?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_access_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_access_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorization_codes: {
        Row: {
          client_id: string
          code_challenge: string | null
          code_challenge_method: string | null
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          redirect_uri: string
          scopes: string[]
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          client_id: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          redirect_uri: string
          scopes?: string[]
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri?: string
          scopes?: string[]
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorization_codes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          allowed_scopes: string[]
          client_id: string
          client_secret_hash: string
          created_at: string
          created_by: string | null
          description: string | null
          grant_types: string[]
          id: string
          is_active: boolean
          is_trusted: boolean
          name: string
          redirect_uris: string[]
          secret_prefix: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          allowed_scopes?: string[]
          client_id: string
          client_secret_hash: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          grant_types?: string[]
          id?: string
          is_active?: boolean
          is_trusted?: boolean
          name: string
          redirect_uris?: string[]
          secret_prefix: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed_scopes?: string[]
          client_id?: string
          client_secret_hash?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          grant_types?: string[]
          id?: string
          is_active?: boolean
          is_trusted?: boolean
          name?: string
          redirect_uris?: string[]
          secret_prefix?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_clients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      omni_auto_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          store_id: string
          updated_at: string
          working_hours: Json
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          store_id: string
          updated_at?: string
          working_hours?: Json
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          store_id?: string
          updated_at?: string
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "omni_auto_replies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      omni_channel_accounts: {
        Row: {
          account_name: string
          channel: string
          created_at: string
          credentials: Json
          external_id: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          status: string
          status_message: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          account_name: string
          channel: string
          created_at?: string
          credentials?: Json
          external_id?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          status?: string
          status_message?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          channel?: string
          created_at?: string
          credentials?: Json
          external_id?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          status?: string
          status_message?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "omni_channel_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      omni_conversations: {
        Row: {
          account_id: string | null
          assigned_to: string | null
          avatar_url: string | null
          channel: string
          converted_order_id: string | null
          created_at: string
          customer_id: string | null
          external_id: string | null
          first_response_seconds: number | null
          id: string
          internal_note: string | null
          last_message_at: string
          last_message_preview: string | null
          message_count: number
          order_id: string | null
          participant_handle: string
          participant_name: string | null
          status: string
          store_id: string
          tags: string[]
          unread_count: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          channel: string
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          external_id?: string | null
          first_response_seconds?: number | null
          id?: string
          internal_note?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          message_count?: number
          order_id?: string | null
          participant_handle: string
          participant_name?: string | null
          status?: string
          store_id: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          channel?: string
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          external_id?: string | null
          first_response_seconds?: number | null
          id?: string
          internal_note?: string | null
          last_message_at?: string
          last_message_preview?: string | null
          message_count?: number
          order_id?: string | null
          participant_handle?: string
          participant_name?: string | null
          status?: string
          store_id?: string
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "omni_conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "omni_channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omni_conversations_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omni_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omni_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omni_conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      omni_messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          external_id: string | null
          id: string
          is_ai: boolean
          sent_by: string | null
          status: string
          store_id: string
        }
        Insert: {
          attachments?: Json
          body?: string
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          external_id?: string | null
          id?: string
          is_ai?: boolean
          sent_by?: string | null
          status?: string
          store_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          external_id?: string | null
          id?: string
          is_ai?: boolean
          sent_by?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omni_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "omni_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omni_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      omni_quick_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          sort_order: number
          store_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sort_order?: number
          store_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sort_order?: number
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "omni_quick_replies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addresses: {
        Row: {
          city: string
          company: string | null
          country_code: string
          created_at: string
          district: string | null
          full_name: string
          id: string
          kind: string
          line1: string
          line2: string | null
          order_id: string
          phone: string | null
          postal_code: string | null
          state: string | null
          store_id: string
          tax_id: string | null
          tax_office: string | null
        }
        Insert: {
          city: string
          company?: string | null
          country_code?: string
          created_at?: string
          district?: string | null
          full_name: string
          id?: string
          kind?: string
          line1: string
          line2?: string | null
          order_id: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          store_id: string
          tax_id?: string | null
          tax_office?: string | null
        }
        Update: {
          city?: string
          company?: string | null
          country_code?: string
          created_at?: string
          district?: string | null
          full_name?: string
          id?: string
          kind?: string
          line1?: string
          line2?: string | null
          order_id?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          store_id?: string
          tax_id?: string | null
          tax_office?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addresses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          message: string | null
          meta: Json
          order_id: string
          store_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          meta?: Json
          order_id: string
          store_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          meta?: Json
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          store_id: string
          tax_rate: number
          tax_total: number
          title: string
          unit_price: number
          variant_id: string | null
          variant_title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          store_id: string
          tax_rate?: number
          tax_total?: number
          title: string
          unit_price?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          store_id?: string
          tax_rate?: number
          tax_total?: number
          title?: string
          unit_price?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          id: string
          is_internal: boolean
          order_id: string
          store_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          order_id: string
          store_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          store_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          store_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          store_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_code: string | null
          discount_total: number
          display_currency: string | null
          exchange_rate: number | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          market_id: string | null
          note: string | null
          order_number: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          placed_at: string
          pricing_snapshot: Json | null
          rate_source: string | null
          shipping_address: Json
          shipping_carrier: string | null
          shipping_total: number
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          tax_total: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: Json
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_code?: string | null
          discount_total?: number
          display_currency?: string | null
          exchange_rate?: number | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          market_id?: string | null
          note?: string | null
          order_number: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          pricing_snapshot?: Json | null
          rate_source?: string | null
          shipping_address?: Json
          shipping_carrier?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          tax_total?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: Json
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_code?: string | null
          discount_total?: number
          display_currency?: string | null
          exchange_rate?: number | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          market_id?: string | null
          note?: string | null
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          pricing_snapshot?: Json | null
          rate_source?: string | null
          shipping_address?: Json
          shipping_carrier?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          tax_total?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          country_code: string
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          country_code?: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          error_message: string | null
          id: string
          kind: string
          payment_id: string
          provider_reference: string | null
          request_payload: Json | null
          response_payload: Json | null
          status: string
          store_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          kind: string
          payment_id: string
          provider_reference?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          kind?: string
          payment_id?: string
          provider_reference?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          captured_at: string | null
          created_at: string
          currency: string
          customer_id: string | null
          failure_reason: string | null
          id: string
          installment_count: number
          metadata: Json
          method: string | null
          order_id: string | null
          provider: string
          provider_reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          failure_reason?: string | null
          id?: string
          installment_count?: number
          metadata?: Json
          method?: string | null
          order_id?: string | null
          provider: string
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          failure_reason?: string | null
          id?: string
          installment_count?: number
          metadata?: Json
          method?: string | null
          order_id?: string | null
          provider?: string
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          created_at: string
          currency: string
          fee_amount: number
          gross_amount: number
          id: string
          net_amount: number
          note: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          reference: string | null
          refund_amount: number
          status: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          note?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          reference?: string | null
          refund_amount?: number
          status?: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          note?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          reference?: string | null
          refund_amount?: number
          status?: Database["public"]["Enums"]["payout_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          resource: string
          updated_at: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          resource: string
          updated_at?: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          resource?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          label: string
          limit_value: number | null
          metric_key: string
          plan_id: string
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          label: string
          limit_value?: number | null
          metric_key: string
          plan_id: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          label?: string
          limit_value?: number | null
          metric_key?: string
          plan_id?: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          commission_rate: number
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          code: string
          commission_rate?: number
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          code?: string
          commission_rate?: number
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number
          is_active: boolean
          name: string
          symbol: string
          symbol_position: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number
          is_active?: boolean
          name: string
          symbol: string
          symbol_position?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number
          is_active?: boolean
          name?: string
          symbol?: string
          symbol_position?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_seo_ai_actions: {
        Row: {
          action: string
          after_value: string | null
          before_value: string | null
          created_at: string
          id: string
          run_id: string
          scope: string
          store_id: string | null
          target: string | null
        }
        Insert: {
          action: string
          after_value?: string | null
          before_value?: string | null
          created_at?: string
          id?: string
          run_id: string
          scope: string
          store_id?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          after_value?: string | null
          before_value?: string | null
          created_at?: string
          id?: string
          run_id?: string
          scope?: string
          store_id?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_seo_ai_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "platform_seo_ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_seo_ai_actions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_seo_ai_runs: {
        Row: {
          actor_id: string | null
          ai_updates: number
          autofixed: number
          average_score: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          issues_found: number
          started_at: string
          status: string
          stores_audited: number
          summary: Json
          total_tokens: number
          trigger: string
        }
        Insert: {
          actor_id?: string | null
          ai_updates?: number
          autofixed?: number
          average_score?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          issues_found?: number
          started_at?: string
          status?: string
          stores_audited?: number
          summary?: Json
          total_tokens?: number
          trigger?: string
        }
        Update: {
          actor_id?: string | null
          ai_updates?: number
          autofixed?: number
          average_score?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          issues_found?: number
          started_at?: string
          status?: string
          stores_audited?: number
          summary?: Json
          total_tokens?: number
          trigger?: string
        }
        Relationships: []
      }
      platform_seo_ai_settings: {
        Row: {
          ai_enabled: boolean
          autofix_enabled: boolean
          concurrency: number
          created_at: string
          daily_hour: number
          daily_minute: number
          focus_keywords: string
          id: string
          is_enabled: boolean
          last_run_at: string | null
          max_items_per_store: number
          max_stores_per_run: number
          model: string
          provider_code: string
          run_blog: boolean
          run_campaigns: boolean
          run_collections: boolean
          run_days: number[]
          run_landing: boolean
          run_products: boolean
          singleton_key: string
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          autofix_enabled?: boolean
          concurrency?: number
          created_at?: string
          daily_hour?: number
          daily_minute?: number
          focus_keywords?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          max_items_per_store?: number
          max_stores_per_run?: number
          model?: string
          provider_code?: string
          run_blog?: boolean
          run_campaigns?: boolean
          run_collections?: boolean
          run_days?: number[]
          run_landing?: boolean
          run_products?: boolean
          singleton_key?: string
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          autofix_enabled?: boolean
          concurrency?: number
          created_at?: string
          daily_hour?: number
          daily_minute?: number
          focus_keywords?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          max_items_per_store?: number
          max_stores_per_run?: number
          model?: string
          provider_code?: string
          run_blog?: boolean
          run_campaigns?: boolean
          run_collections?: boolean
          run_days?: number[]
          run_landing?: boolean
          run_products?: boolean
          singleton_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          is_public: boolean
          key: string
          label: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_public?: boolean
          key: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          is_public?: boolean
          key?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      price_list_items: {
        Row: {
          compare_at_price: number | null
          country_code: string | null
          created_at: string
          currency: string
          id: string
          price: number
          price_list_id: string
          product_id: string
          store_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          compare_at_price?: number | null
          country_code?: string | null
          created_at?: string
          currency: string
          id?: string
          price: number
          price_list_id: string
          product_id: string
          store_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          compare_at_price?: number | null
          country_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          price?: number
          price_list_id?: string
          product_id?: string
          store_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          code: string | null
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          starts_at: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          currency: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          starts_at?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          starts_at?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      price_snapshots: {
        Row: {
          cart_token: string | null
          created_at: string
          currency: string
          exchange_rate: number | null
          expires_at: string | null
          id: string
          market_id: string | null
          order_id: string | null
          payload: Json
          rate_source: string | null
          store_id: string
        }
        Insert: {
          cart_token?: string | null
          created_at?: string
          currency: string
          exchange_rate?: number | null
          expires_at?: string | null
          id?: string
          market_id?: string | null
          order_id?: string | null
          payload?: Json
          rate_source?: string | null
          store_id: string
        }
        Update: {
          cart_token?: string | null
          created_at?: string
          currency?: string
          exchange_rate?: number | null
          expires_at?: string | null
          id?: string
          market_id?: string | null
          order_id?: string | null
          payload?: Json
          rate_source?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshots_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_audit_logs: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          market_id: string | null
          new_price: number | null
          old_price: number | null
          product_id: string | null
          reason: string | null
          source: string | null
          store_id: string
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          market_id?: string | null
          new_price?: number | null
          old_price?: number | null
          product_id?: string | null
          reason?: string | null
          source?: string | null
          store_id: string
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          market_id?: string | null
          new_price?: number | null
          old_price?: number | null
          product_id?: string | null
          reason?: string | null
          source?: string | null
          store_id?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_audit_logs_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_audit_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_audit_logs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_campaigns: {
        Row: {
          created_at: string
          currency: string
          ends_at: string
          id: string
          is_active: boolean
          market_id: string | null
          markup_type: Database["public"]["Enums"]["markup_type"]
          markup_value: number
          name: string
          price_list_id: string | null
          rate: number | null
          rounding: Database["public"]["Enums"]["rounding_mode"]
          starts_at: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          ends_at: string
          id?: string
          is_active?: boolean
          market_id?: string | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          markup_value?: number
          name: string
          price_list_id?: string | null
          rate?: number | null
          rounding?: Database["public"]["Enums"]["rounding_mode"]
          starts_at: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          market_id?: string | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          markup_value?: number
          name?: string
          price_list_id?: string | null
          rate?: number | null
          rounding?: Database["public"]["Enums"]["rounding_mode"]
          starts_at?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_campaigns_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_campaigns_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          starts_at: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          starts_at?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          starts_at?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          product_id: string
        }
        Insert: {
          collection_id: string
          product_id: string
        }
        Update: {
          collection_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          position: number
          product_id: string
          storage_path: string | null
          store_id: string
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id: string
          storage_path?: string | null
          store_id: string
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          storage_path?: string | null
          store_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_market_prices: {
        Row: {
          compare_at_price: number | null
          created_at: string
          currency: string
          id: string
          market_id: string
          price: number | null
          product_id: string
          source: Database["public"]["Enums"]["price_source"]
          store_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          currency: string
          id?: string
          market_id: string
          price?: number | null
          product_id: string
          source?: Database["public"]["Enums"]["price_source"]
          store_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          currency?: string
          id?: string
          market_id?: string
          price?: number | null
          product_id?: string
          source?: Database["public"]["Enums"]["price_source"]
          store_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_market_prices_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_market_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_market_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_market_prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          color_hex: string | null
          created_at: string
          id: string
          option_id: string
          position: number
          store_id: string
          value: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string
          id?: string
          option_id: string
          position?: number
          store_id: string
          value: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string
          id?: string
          option_id?: string
          position?: number
          store_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_values_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          product_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          author_name: string
          created_at: string
          customer_id: string | null
          id: string
          product_id: string
          question: string
          status: string
          store_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          author_name: string
          created_at?: string
          customer_id?: string | null
          id?: string
          product_id: string
          question: string
          status?: string
          store_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          author_name?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          product_id?: string
          question?: string
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          customer_id: string | null
          id: string
          is_verified_purchase: boolean
          product_id: string
          rating: number
          replied_at: string | null
          reply: string | null
          status: Database["public"]["Enums"]["review_status"]
          store_id: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          author_name: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_verified_purchase?: boolean
          product_id: string
          rating: number
          replied_at?: string | null
          reply?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          store_id: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_verified_purchase?: boolean
          product_id?: string
          rating?: number
          replied_at?: string | null
          reply?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          store_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_options: {
        Row: {
          created_at: string
          id: string
          option_id: string
          option_value_id: string
          store_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          option_value_id: string
          store_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          option_value_id?: string
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          id: string
          image_id: string | null
          low_stock_threshold: number
          options: Json
          position: number
          price: number
          product_id: string
          sku: string | null
          stock: number
          store_id: string
          title: string
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          id?: string
          image_id?: string | null
          low_stock_threshold?: number
          options?: Json
          position?: number
          price?: number
          product_id: string
          sku?: string | null
          stock?: number
          store_id: string
          title?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          id?: string
          image_id?: string | null
          low_stock_threshold?: number
          options?: Json
          position?: number
          price?: number
          product_id?: string
          sku?: string | null
          stock?: number
          store_id?: string
          title?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "product_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_price: number
          brand_id: string | null
          category_id: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          currency: string
          description: string | null
          height_cm: number | null
          id: string
          length_cm: number | null
          product_type: string | null
          seller_id: string | null
          seller_name: string | null
          seo: Json
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          store_id: string
          tags: string[]
          tax_class_id: string | null
          tax_rate: number
          title: string
          track_inventory: boolean
          updated_at: string
          variant_options: Json
          vendor: string | null
          vendor_id: string | null
          video_url: string | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          base_price?: number
          brand_id?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          product_type?: string | null
          seller_id?: string | null
          seller_name?: string | null
          seo?: Json
          sku?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          store_id: string
          tags?: string[]
          tax_class_id?: string | null
          tax_rate?: number
          title: string
          track_inventory?: boolean
          updated_at?: string
          variant_options?: Json
          vendor?: string | null
          vendor_id?: string | null
          video_url?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          base_price?: number
          brand_id?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          product_type?: string | null
          seller_id?: string | null
          seller_name?: string | null
          seo?: Json
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          store_id?: string
          tags?: string[]
          tax_class_id?: string | null
          tax_rate?: number
          title?: string
          track_inventory?: boolean
          updated_at?: string
          variant_options?: Json
          vendor?: string | null
          vendor_id?: string | null
          video_url?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tax_class_id_fkey"
            columns: ["tax_class_id"]
            isOneToOne: false
            referencedRelation: "tax_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          received_quantity: number
          sku: string | null
          store_id: string
          title: string
          unit_cost: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          sku?: string | null
          store_id: string
          title: string
          unit_cost?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          sku?: string | null
          store_id?: string
          title?: string
          unit_cost?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          currency: string
          expected_at: string | null
          id: string
          note: string | null
          received_at: string | null
          status: string
          store_id: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_at?: string | null
          id?: string
          note?: string | null
          received_at?: string | null
          status?: string
          store_id: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_at?: string | null
          id?: string
          note?: string | null
          received_at?: string | null
          status?: string
          store_id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          bucket_key: string
          created_at: string
          hits: number
          id: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          bucket_key: string
          created_at?: string
          hits?: number
          id?: string
          updated_at?: string
          window_started_at: string
        }
        Update: {
          bucket_key?: string
          created_at?: string
          hits?: number
          id?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string | null
          payment_id: string | null
          processed_at: string | null
          processed_by: string | null
          provider_reference: string | null
          reason: string | null
          return_request_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider_reference?: string | null
          reason?: string | null
          return_request_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider_reference?: string | null
          reason?: string | null
          return_request_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_item_id: string | null
          quantity: number
          return_id: string
          store_id: string
          title: string
          unit_price: number
          variant_id: string | null
          variant_title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          order_item_id?: string | null
          quantity?: number
          return_id: string
          store_id: string
          title: string
          unit_price?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_item_id?: string | null
          quantity?: number
          return_id?: string
          store_id?: string
          title?: string
          unit_price?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          created_at: string
          currency: string
          customer_id: string | null
          customer_note: string | null
          id: string
          order_id: string
          reason: Database["public"]["Enums"]["return_reason"]
          refund_amount: number
          resolved_at: string | null
          restock: boolean
          return_number: string
          staff_note: string | null
          status: Database["public"]["Enums"]["return_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_note?: string | null
          id?: string
          order_id: string
          reason?: Database["public"]["Enums"]["return_reason"]
          refund_amount?: number
          resolved_at?: string | null
          restock?: boolean
          return_number: string
          staff_note?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_note?: string | null
          id?: string
          order_id?: string
          reason?: Database["public"]["Enums"]["return_reason"]
          refund_amount?: number
          resolved_at?: string | null
          restock?: boolean
          return_number?: string
          staff_note?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          label: string
          scope: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label: string
          scope?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label?: string
          scope?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          kind: string
          meta: Json
          severity: string
          store_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          kind: string
          meta?: Json
          severity?: string
          store_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          kind?: string
          meta?: Json
          severity?: string
          store_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_orders: {
        Row: {
          commission_total: number
          created_at: string
          currency: string
          id: string
          items_total: number
          order_id: string
          payout_total: number
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          commission_total?: number
          created_at?: string
          currency?: string
          id?: string
          items_total?: number
          order_id: string
          payout_total?: number
          seller_id: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          commission_total?: number
          created_at?: string
          currency?: string
          id?: string
          items_total?: number
          order_id?: string
          payout_total?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          currency: string
          iban: string | null
          id: string
          note: string | null
          processed_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          note?: string | null
          processed_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          note?: string | null
          processed_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_requests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_products: {
        Row: {
          commission_rate: number | null
          created_at: string
          id: string
          is_active: boolean
          product_id: string
          seller_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          product_id: string
          seller_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          seller_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audit_pages: {
        Row: {
          audit_id: string
          created_at: string
          critical_count: number
          entity_id: string | null
          entity_type: string
          id: string
          indexable: boolean
          info_count: number
          score: number
          scores: Json
          store_id: string
          title: string | null
          url: string
          warning_count: number
        }
        Insert: {
          audit_id: string
          created_at?: string
          critical_count?: number
          entity_id?: string | null
          entity_type: string
          id?: string
          indexable?: boolean
          info_count?: number
          score?: number
          scores?: Json
          store_id: string
          title?: string | null
          url: string
          warning_count?: number
        }
        Update: {
          audit_id?: string
          created_at?: string
          critical_count?: number
          entity_id?: string | null
          entity_type?: string
          id?: string
          indexable?: boolean
          info_count?: number
          score?: number
          scores?: Json
          store_id?: string
          title?: string | null
          url?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_audit_pages_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "seo_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_audit_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audits: {
        Row: {
          content_score: number
          created_at: string
          critical_count: number
          id: string
          info_count: number
          linking_score: number
          mobile_score: number
          onpage_score: number
          pages_count: number
          passed_count: number
          performance_score: number
          schema_score: number
          score: number
          source: string
          status: string
          store_id: string
          summary: Json
          technical_score: number
          triggered_by: string | null
          updated_at: string
          warning_count: number
        }
        Insert: {
          content_score?: number
          created_at?: string
          critical_count?: number
          id?: string
          info_count?: number
          linking_score?: number
          mobile_score?: number
          onpage_score?: number
          pages_count?: number
          passed_count?: number
          performance_score?: number
          schema_score?: number
          score?: number
          source?: string
          status?: string
          store_id: string
          summary?: Json
          technical_score?: number
          triggered_by?: string | null
          updated_at?: string
          warning_count?: number
        }
        Update: {
          content_score?: number
          created_at?: string
          critical_count?: number
          id?: string
          info_count?: number
          linking_score?: number
          mobile_score?: number
          onpage_score?: number
          pages_count?: number
          passed_count?: number
          performance_score?: number
          schema_score?: number
          score?: number
          source?: string
          status?: string
          store_id?: string
          summary?: Json
          technical_score?: number
          triggered_by?: string | null
          updated_at?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_audits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_issues: {
        Row: {
          audit_id: string | null
          autofixable: boolean
          category: string
          code: string
          created_at: string
          detected_at: string
          entity_id: string | null
          entity_type: string
          fix_hint: string | null
          id: string
          message: string
          meta: Json
          resolved_at: string | null
          severity: string
          status: string
          store_id: string
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          audit_id?: string | null
          autofixable?: boolean
          category: string
          code: string
          created_at?: string
          detected_at?: string
          entity_id?: string | null
          entity_type?: string
          fix_hint?: string | null
          id?: string
          message: string
          meta?: Json
          resolved_at?: string | null
          severity: string
          status?: string
          store_id: string
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          audit_id?: string | null
          autofixable?: boolean
          category?: string
          code?: string
          created_at?: string
          detected_at?: string
          entity_id?: string | null
          entity_type?: string
          fix_hint?: string | null
          id?: string
          message?: string
          meta?: Json
          resolved_at?: string | null
          severity?: string
          status?: string
          store_id?: string
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_issues_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "seo_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_issues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          created_at: string
          id: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string
          created_at: string
          delivered_at: string | null
          id: string
          note: string | null
          order_id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          store_id: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          carrier: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          note?: string | null
          order_id: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          store_id: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          note?: string | null
          order_id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          store_id?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_methods: {
        Row: {
          base_price: number
          carrier_code: string | null
          created_at: string
          currency: string
          description: string | null
          free_over: number | null
          id: string
          is_active: boolean
          max_delivery_days: number | null
          min_delivery_days: number | null
          name: string
          sort_order: number
          store_id: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          base_price?: number
          carrier_code?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          free_over?: number | null
          id?: string
          is_active?: boolean
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          name: string
          sort_order?: number
          store_id: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          base_price?: number
          carrier_code?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          free_over?: number | null
          id?: string
          is_active?: boolean
          max_delivery_days?: number | null
          min_delivery_days?: number | null
          name?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_methods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_methods_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          connector_id: string | null
          created_at: string
          eta_days: number | null
          free_over: number | null
          id: string
          is_active: boolean
          max_weight_grams: number | null
          min_weight_grams: number
          price: number
          sort_order: number
          store_id: string
          title: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          connector_id?: string | null
          created_at?: string
          eta_days?: number | null
          free_over?: number | null
          id?: string
          is_active?: boolean
          max_weight_grams?: number | null
          min_weight_grams?: number
          price?: number
          sort_order?: number
          store_id: string
          title: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          connector_id?: string | null
          created_at?: string
          eta_days?: number | null
          free_over?: number | null
          id?: string
          is_active?: boolean
          max_weight_grams?: number | null
          min_weight_grams?: number
          price?: number
          sort_order?: number
          store_id?: string
          title?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          cities: string[]
          countries: string[]
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          cities?: string[]
          countries?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          cities?: string[]
          countries?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      site_sections: {
        Row: {
          badge: string | null
          created_at: string
          eyebrow: string | null
          id: string
          is_enabled: boolean
          items: Json
          kind: string
          primary_href: string | null
          primary_label: string | null
          secondary_href: string | null
          secondary_label: string | null
          section_key: string
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          eyebrow?: string | null
          id?: string
          is_enabled?: boolean
          items?: Json
          kind: string
          primary_href?: string | null
          primary_label?: string | null
          secondary_href?: string | null
          secondary_label?: string | null
          section_key: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          eyebrow?: string | null
          id?: string
          is_enabled?: boolean
          items?: Json
          kind?: string
          primary_href?: string | null
          primary_label?: string | null
          secondary_href?: string | null
          secondary_label?: string | null
          section_key?: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          created_at: string
          email: string
          id: string
          notified_at: string | null
          product_id: string
          store_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          product_id: string
          store_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          product_id?: string
          store_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          quantity: number
          received_quantity: number
          sku: string | null
          store_id: string
          title: string
          transfer_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
          received_quantity?: number
          sku?: string | null
          store_id: string
          title: string
          transfer_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
          received_quantity?: number
          sku?: string | null
          store_id?: string
          title?: string
          transfer_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          from_warehouse_id: string
          id: string
          note: string | null
          received_at: string | null
          shipped_at: string | null
          status: Database["public"]["Enums"]["stock_transfer_status"]
          store_id: string
          to_warehouse_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          from_warehouse_id: string
          id?: string
          note?: string | null
          received_at?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["stock_transfer_status"]
          store_id: string
          to_warehouse_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          from_warehouse_id?: string
          id?: string
          note?: string | null
          received_at?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["stock_transfer_status"]
          store_id?: string
          to_warehouse_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      store_admin_notes: {
        Row: {
          author_id: string
          created_at: string
          id: string
          is_pinned: boolean
          note: string
          store_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          note: string
          store_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          note?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_admin_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_ai_settings: {
        Row: {
          brand_tone: string
          created_at: string
          creativity: number
          id: string
          is_enabled: boolean
          language: string
          model: string
          monthly_token_limit: number
          provider_code: string
          store_id: string
          updated_at: string
        }
        Insert: {
          brand_tone?: string
          created_at?: string
          creativity?: number
          id?: string
          is_enabled?: boolean
          language?: string
          model?: string
          monthly_token_limit?: number
          provider_code?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          brand_tone?: string
          created_at?: string
          creativity?: number
          id?: string
          is_enabled?: boolean
          language?: string
          model?: string
          monthly_token_limit?: number
          provider_code?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_currencies: {
        Row: {
          created_at: string
          currency: string
          decimal_separator: string
          id: string
          is_active: boolean
          is_base: boolean
          manual_rate: number | null
          markup_type: Database["public"]["Enums"]["markup_type"]
          markup_value: number
          rounding: Database["public"]["Enums"]["rounding_mode"]
          store_id: string
          symbol_position: string
          thousands_separator: string
          updated_at: string
          use_manual_rate: boolean
        }
        Insert: {
          created_at?: string
          currency: string
          decimal_separator?: string
          id?: string
          is_active?: boolean
          is_base?: boolean
          manual_rate?: number | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          markup_value?: number
          rounding?: Database["public"]["Enums"]["rounding_mode"]
          store_id: string
          symbol_position?: string
          thousands_separator?: string
          updated_at?: string
          use_manual_rate?: boolean
        }
        Update: {
          created_at?: string
          currency?: string
          decimal_separator?: string
          id?: string
          is_active?: boolean
          is_base?: boolean
          manual_rate?: number | null
          markup_type?: Database["public"]["Enums"]["markup_type"]
          markup_value?: number
          rounding?: Database["public"]["Enums"]["rounding_mode"]
          store_id?: string
          symbol_position?: string
          thousands_separator?: string
          updated_at?: string
          use_manual_rate?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "store_currencies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_daily_stats: {
        Row: {
          abandoned_carts: number
          created_at: string
          id: string
          new_customers: number
          orders_count: number
          revenue: number
          sessions: number
          stat_date: string
          store_id: string
          visitors: number
        }
        Insert: {
          abandoned_carts?: number
          created_at?: string
          id?: string
          new_customers?: number
          orders_count?: number
          revenue?: number
          sessions?: number
          stat_date: string
          store_id: string
          visitors?: number
        }
        Update: {
          abandoned_carts?: number
          created_at?: string
          id?: string
          new_customers?: number
          orders_count?: number
          revenue?: number
          sessions?: number
          stat_date?: string
          store_id?: string
          visitors?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_daily_stats_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_domains: {
        Row: {
          created_at: string
          dns_records: Json
          dns_target: string | null
          hostname: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          last_error: string | null
          redirect_to_hostname: string | null
          ssl_active: boolean
          ssl_expires_at: string | null
          ssl_issued_at: string | null
          ssl_status: string
          status: Database["public"]["Enums"]["domain_status"]
          store_id: string
          type: Database["public"]["Enums"]["domain_type"]
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          dns_records?: Json
          dns_target?: string | null
          hostname: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          redirect_to_hostname?: string | null
          ssl_active?: boolean
          ssl_expires_at?: string | null
          ssl_issued_at?: string | null
          ssl_status?: string
          status?: Database["public"]["Enums"]["domain_status"]
          store_id: string
          type?: Database["public"]["Enums"]["domain_type"]
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          dns_records?: Json
          dns_target?: string | null
          hostname?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          redirect_to_hostname?: string | null
          ssl_active?: boolean
          ssl_expires_at?: string | null
          ssl_issued_at?: string | null
          ssl_status?: string
          status?: Database["public"]["Enums"]["domain_status"]
          store_id?: string
          type?: Database["public"]["Enums"]["domain_type"]
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_locales: {
        Row: {
          code: string
          created_at: string
          currency: string | null
          dir: string
          fallback_code: string | null
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          locale: string
          native_label: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string | null
          dir?: string
          fallback_code?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label: string
          locale: string
          native_label?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string | null
          dir?: string
          fallback_code?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          locale?: string
          native_label?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_locales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_menu_items: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          kind: string
          label: string
          location: string
          menu_id: string | null
          parent_id: string | null
          position: number
          store_id: string
          target: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          kind?: string
          label: string
          location?: string
          menu_id?: string | null
          parent_id?: string | null
          position?: number
          store_id: string
          target?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          kind?: string
          label?: string
          location?: string
          menu_id?: string | null
          parent_id?: string | null
          position?: number
          store_id?: string
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "store_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_menu_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_page_tags: {
        Row: {
          created_at: string
          page_id: string
          store_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          page_id: string
          store_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          page_id?: string
          store_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_page_tags_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "store_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_page_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_page_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pages: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          category_id: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean
          page_kind: string
          published_at: string | null
          scheduled_at: string | null
          seo: Json
          seo_description: string | null
          show_in_footer: boolean
          slug: string
          sort_order: number
          status: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          page_kind?: string
          published_at?: string | null
          scheduled_at?: string | null
          seo?: Json
          seo_description?: string | null
          show_in_footer?: boolean
          slug: string
          sort_order?: number
          status?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          page_kind?: string
          published_at?: string | null
          scheduled_at?: string | null
          seo?: Json
          seo_description?: string | null
          show_in_footer?: boolean
          slug?: string
          sort_order?: number
          status?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "blog_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_pages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_methods: {
        Row: {
          config_ref: string | null
          connector_id: string
          created_at: string
          display_name: string
          extra_fee_rate: number
          id: string
          installments_enabled: boolean
          instructions: string | null
          is_active: boolean
          sort_order: number
          store_id: string
          test_mode: boolean
          updated_at: string
        }
        Insert: {
          config_ref?: string | null
          connector_id: string
          created_at?: string
          display_name: string
          extra_fee_rate?: number
          id?: string
          installments_enabled?: boolean
          instructions?: string | null
          is_active?: boolean
          sort_order?: number
          store_id: string
          test_mode?: boolean
          updated_at?: string
        }
        Update: {
          config_ref?: string | null
          connector_id?: string
          created_at?: string
          display_name?: string
          extra_fee_rate?: number
          id?: string
          installments_enabled?: boolean
          instructions?: string | null
          is_active?: boolean
          sort_order?: number
          store_id?: string
          test_mode?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_methods_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payment_methods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_popups: {
        Row: {
          accent_color: string | null
          animation: string
          body: string
          clicks: number
          created_at: string
          cta_label: string | null
          cta_url: string | null
          display_rules: Json
          ends_at: string | null
          headline: string
          id: string
          image_url: string | null
          impressions: number
          is_active: boolean
          name: string
          position: string
          sort_order: number
          starts_at: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          animation?: string
          body?: string
          clicks?: number
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          display_rules?: Json
          ends_at?: string | null
          headline?: string
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          name: string
          position?: string
          sort_order?: number
          starts_at?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          animation?: string
          body?: string
          clicks?: number
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          display_rules?: Json
          ends_at?: string | null
          headline?: string
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          name?: string
          position?: string
          sort_order?: number
          starts_at?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_popups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pricing_settings: {
        Row: {
          base_currency: string
          created_at: string
          default_markup_type: Database["public"]["Enums"]["markup_type"]
          default_markup_value: number
          default_rounding: Database["public"]["Enums"]["rounding_mode"]
          geolocation_enabled: boolean
          last_rate_sync_at: string | null
          max_change_percent: number
          min_margin_percent: number | null
          provider_code: string | null
          require_approval: boolean
          stale_after_hours: number
          store_id: string
          update_frequency: Database["public"]["Enums"]["rate_update_frequency"]
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          default_markup_type?: Database["public"]["Enums"]["markup_type"]
          default_markup_value?: number
          default_rounding?: Database["public"]["Enums"]["rounding_mode"]
          geolocation_enabled?: boolean
          last_rate_sync_at?: string | null
          max_change_percent?: number
          min_margin_percent?: number | null
          provider_code?: string | null
          require_approval?: boolean
          stale_after_hours?: number
          store_id: string
          update_frequency?: Database["public"]["Enums"]["rate_update_frequency"]
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          default_markup_type?: Database["public"]["Enums"]["markup_type"]
          default_markup_value?: number
          default_rounding?: Database["public"]["Enums"]["rounding_mode"]
          geolocation_enabled?: boolean
          last_rate_sync_at?: string | null
          max_change_percent?: number
          min_margin_percent?: number | null
          provider_code?: string | null
          require_approval?: boolean
          stale_after_hours?: number
          store_id?: string
          update_frequency?: Database["public"]["Enums"]["rate_update_frequency"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pricing_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_feeds: {
        Row: {
          category_map: Json
          created_at: string
          currency: string
          id: string
          include_out_of_stock: boolean
          is_active: boolean
          item_count: number
          kind: string
          last_built_at: string | null
          store_id: string
          token: string
          updated_at: string
        }
        Insert: {
          category_map?: Json
          created_at?: string
          currency?: string
          id?: string
          include_out_of_stock?: boolean
          is_active?: boolean
          item_count?: number
          kind: string
          last_built_at?: string | null
          store_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          category_map?: Json
          created_at?: string
          currency?: string
          id?: string
          include_out_of_stock?: boolean
          is_active?: boolean
          item_count?: number
          kind?: string
          last_built_at?: string | null
          store_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_product_feeds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_seo_404s: {
        Row: {
          created_at: string
          hit_count: number
          id: string
          last_seen_at: string
          path: string
          referrer: string | null
          store_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          hit_count?: number
          id?: string
          last_seen_at?: string
          path: string
          referrer?: string | null
          store_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          hit_count?: number
          id?: string
          last_seen_at?: string
          path?: string
          referrer?: string | null
          store_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_seo_404s_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_seo_redirects: {
        Row: {
          created_at: string
          hit_count: number
          id: string
          is_active: boolean
          last_hit_at: string | null
          source_path: string
          status_code: number
          store_id: string
          target_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hit_count?: number
          id?: string
          is_active?: boolean
          last_hit_at?: string | null
          source_path: string
          status_code?: number
          store_id: string
          target_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hit_count?: number
          id?: string
          is_active?: boolean
          last_hit_at?: string | null
          source_path?: string
          status_code?: number
          store_id?: string
          target_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_seo_redirects_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          address: Json
          auto_currency_rates: boolean
          base_currency: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_locale: string
          default_tax_rate: number
          display_currencies: string[]
          guest_checkout: boolean
          legal_name: string | null
          seo: Json
          social: Json
          store_id: string
          supported_locales: string[]
          tax_included_prices: boolean
          tax_number: string | null
          updated_at: string
          weight_unit: string
        }
        Insert: {
          address?: Json
          auto_currency_rates?: boolean
          base_currency?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_locale?: string
          default_tax_rate?: number
          display_currencies?: string[]
          guest_checkout?: boolean
          legal_name?: string | null
          seo?: Json
          social?: Json
          store_id: string
          supported_locales?: string[]
          tax_included_prices?: boolean
          tax_number?: string | null
          updated_at?: string
          weight_unit?: string
        }
        Update: {
          address?: Json
          auto_currency_rates?: boolean
          base_currency?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_locale?: string
          default_tax_rate?: number
          display_currencies?: string[]
          guest_checkout?: boolean
          legal_name?: string | null
          seo?: Json
          social?: Json
          store_id?: string
          supported_locales?: string[]
          tax_included_prices?: boolean
          tax_number?: string | null
          updated_at?: string
          weight_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_site_kit: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          last_test_result: string | null
          last_tested_at: string | null
          provider: string
          public_config: Json
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_test_result?: string | null
          last_tested_at?: string | null
          provider: string
          public_config?: Json
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_test_result?: string | null
          last_tested_at?: string | null
          provider?: string
          public_config?: Json
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_site_kit_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_site_kit_secrets: {
        Row: {
          created_at: string
          provider: string
          secret_config: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          provider: string
          secret_config?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          provider?: string
          secret_config?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_stories: {
        Row: {
          caption: string
          channel: string
          created_at: string
          error: string | null
          id: string
          image_url: string | null
          link_url: string | null
          product_id: string | null
          published_at: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          caption?: string
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          product_id?: string | null
          published_at?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          caption?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          product_id?: string | null
          published_at?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_stories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_stories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_theme_sections: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          position: number
          settings: Json
          store_id: string
          type: string
          updated_at: string
          visibility: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          position?: number
          settings?: Json
          store_id: string
          type: string
          updated_at?: string
          visibility?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          position?: number
          settings?: Json
          store_id?: string
          type?: string
          updated_at?: string
          visibility?: Json
        }
        Relationships: [
          {
            foreignKeyName: "store_theme_sections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_theme_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          label: string
          snapshot: Json
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          label?: string
          snapshot: Json
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          label?: string
          snapshot?: Json
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_theme_versions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_themes: {
        Row: {
          accent_color: string
          announcement: string | null
          background_color: string
          button_style: string
          card_style: string
          content_width: number
          created_at: string
          custom_css: string | null
          custom_js: string | null
          design_tokens: Json
          font_pair: string
          hero_cta_label: string
          hero_subtitle: string
          hero_title: string
          is_published: boolean
          layout: string
          logo_url: string | null
          preset: string
          primary_color: string
          published_at: string | null
          radius: number
          section_spacing: number
          show_announcement: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          announcement?: string | null
          background_color?: string
          button_style?: string
          card_style?: string
          content_width?: number
          created_at?: string
          custom_css?: string | null
          custom_js?: string | null
          design_tokens?: Json
          font_pair?: string
          hero_cta_label?: string
          hero_subtitle?: string
          hero_title?: string
          is_published?: boolean
          layout?: string
          logo_url?: string | null
          preset?: string
          primary_color?: string
          published_at?: string | null
          radius?: number
          section_spacing?: number
          show_announcement?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          announcement?: string | null
          background_color?: string
          button_style?: string
          card_style?: string
          content_width?: number
          created_at?: string
          custom_css?: string | null
          custom_js?: string | null
          design_tokens?: Json
          font_pair?: string
          hero_cta_label?: string
          hero_subtitle?: string
          hero_title?: string
          is_published?: boolean
          layout?: string
          logo_url?: string | null
          preset?: string
          primary_color?: string
          published_at?: string | null
          radius?: number
          section_spacing?: number
          show_announcement?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_themes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_users: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          permissions: string[]
          role: Database["public"]["Enums"]["store_role"]
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          permissions?: string[]
          role?: Database["public"]["Enums"]["store_role"]
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          permissions?: string[]
          role?: Database["public"]["Enums"]["store_role"]
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_users_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_webhooks: {
        Row: {
          api_version: string
          created_at: string
          description: string | null
          events: string[]
          id: string
          is_active: boolean
          last_error: string | null
          last_triggered_at: string | null
          max_attempts: number
          name: string
          secret: string
          signature_algorithm: string
          store_id: string
          target_url: string
          updated_at: string
        }
        Insert: {
          api_version?: string
          created_at?: string
          description?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_triggered_at?: string | null
          max_attempts?: number
          name: string
          secret?: string
          signature_algorithm?: string
          store_id: string
          target_url: string
          updated_at?: string
        }
        Update: {
          api_version?: string
          created_at?: string
          description?: string | null
          events?: string[]
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_triggered_at?: string | null
          max_attempts?: number
          name?: string
          secret?: string
          signature_algorithm?: string
          store_id?: string
          target_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_webhooks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          currency: string
          id: string
          industry: string | null
          is_demo: boolean
          locale: string
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          onboarding_step: number
          organization_id: string | null
          owner_id: string | null
          plan_id: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          industry?: string | null
          is_demo?: boolean
          locale?: string
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          onboarding_step?: number
          organization_id?: string | null
          owner_id?: string | null
          plan_id?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          industry?: string | null
          is_demo?: boolean
          locale?: string
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          organization_id?: string | null
          owner_id?: string | null
          plan_id?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_items: {
        Row: {
          created_at: string
          currency: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["subscription_item_kind"]
          metric_key: string | null
          quantity: number
          store_id: string
          subscription_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description: string
          id?: string
          kind?: Database["public"]["Enums"]["subscription_item_kind"]
          metric_key?: string | null
          quantity?: number
          store_id: string
          subscription_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["subscription_item_kind"]
          metric_key?: string | null
          quantity?: number
          store_id?: string
          subscription_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string
          current_period_start: string
          id: string
          meta: Json
          plan_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          store_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          meta?: Json
          plan_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          store_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          meta?: Json
          plan_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          store_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_feed_runs: {
        Row: {
          created_at: string
          error: string | null
          feed_id: string
          finished_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["supplier_feed_run_status"]
          store_id: string
          totals: Json
          trigger: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          feed_id: string
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["supplier_feed_run_status"]
          store_id: string
          totals?: Json
          trigger?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          feed_id?: string
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["supplier_feed_run_status"]
          store_id?: string
          totals?: Json
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_feed_runs_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "supplier_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_feed_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_feeds: {
        Row: {
          auth_header: string | null
          brand_map: Json
          category_map: Json
          create_missing: boolean
          created_at: string
          field_map: Json
          id: string
          import_images: boolean
          is_active: boolean
          item_path: string | null
          kind: Database["public"]["Enums"]["supplier_feed_kind"]
          last_error: string | null
          last_run_at: string | null
          last_status:
            | Database["public"]["Enums"]["supplier_feed_run_status"]
            | null
          match_key: Database["public"]["Enums"]["supplier_match_key"]
          name: string
          next_run_at: string | null
          price_rules: Json
          schedule: Database["public"]["Enums"]["supplier_feed_schedule"]
          source_url: string
          stats: Json
          stock_rules: Json
          store_id: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          auth_header?: string | null
          brand_map?: Json
          category_map?: Json
          create_missing?: boolean
          created_at?: string
          field_map?: Json
          id?: string
          import_images?: boolean
          is_active?: boolean
          item_path?: string | null
          kind?: Database["public"]["Enums"]["supplier_feed_kind"]
          last_error?: string | null
          last_run_at?: string | null
          last_status?:
            | Database["public"]["Enums"]["supplier_feed_run_status"]
            | null
          match_key?: Database["public"]["Enums"]["supplier_match_key"]
          name: string
          next_run_at?: string | null
          price_rules?: Json
          schedule?: Database["public"]["Enums"]["supplier_feed_schedule"]
          source_url: string
          stats?: Json
          stock_rules?: Json
          store_id: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_header?: string | null
          brand_map?: Json
          category_map?: Json
          create_missing?: boolean
          created_at?: string
          field_map?: Json
          id?: string
          import_images?: boolean
          is_active?: boolean
          item_path?: string | null
          kind?: Database["public"]["Enums"]["supplier_feed_kind"]
          last_error?: string | null
          last_run_at?: string | null
          last_status?:
            | Database["public"]["Enums"]["supplier_feed_run_status"]
            | null
          match_key?: Database["public"]["Enums"]["supplier_match_key"]
          name?: string
          next_run_at?: string | null
          price_rules?: Json
          schedule?: Database["public"]["Enums"]["supplier_feed_schedule"]
          source_url?: string
          stats?: Json
          stock_rules?: Json
          store_id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_feeds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_feeds_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          computed_price: number | null
          created_at: string
          currency: string
          external_id: string | null
          feed_id: string
          id: string
          images: Json
          last_seen_at: string
          matched_at: string | null
          product_id: string | null
          raw: Json
          sku: string | null
          stock: number
          store_id: string
          supplier_id: string | null
          supplier_price: number
          title: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          computed_price?: number | null
          created_at?: string
          currency?: string
          external_id?: string | null
          feed_id: string
          id?: string
          images?: Json
          last_seen_at?: string
          matched_at?: string | null
          product_id?: string | null
          raw?: Json
          sku?: string | null
          stock?: number
          store_id: string
          supplier_id?: string | null
          supplier_price?: number
          title: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          computed_price?: number | null
          created_at?: string
          currency?: string
          external_id?: string | null
          feed_id?: string
          id?: string
          images?: Json
          last_seen_at?: string
          matched_at?: string | null
          product_id?: string | null
          raw?: Json
          sku?: string | null
          stock?: number
          store_id?: string
          supplier_id?: string | null
          supplier_price?: number
          title?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "supplier_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          auto_send_orders: boolean
          contact_name: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          is_active: boolean
          is_dropship: boolean
          lead_time_days: number
          name: string
          note: string | null
          order_endpoint: string | null
          phone: string | null
          portal_enabled: boolean
          portal_user_id: string | null
          store_id: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          auto_send_orders?: boolean
          contact_name?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_dropship?: boolean
          lead_time_days?: number
          name: string
          note?: string | null
          order_endpoint?: string | null
          phone?: string | null
          portal_enabled?: boolean
          portal_user_id?: string | null
          store_id: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          auto_send_orders?: boolean
          contact_name?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_dropship?: boolean
          lead_time_days?: number
          name?: string
          note?: string | null
          order_endpoint?: string | null
          phone?: string | null
          portal_enabled?: boolean
          portal_user_id?: string | null
          store_id?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      support_departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          author_name: string | null
          author_role: Database["public"]["Enums"]["support_author_role"]
          body: string
          created_at: string
          id: string
          is_internal: boolean
          read_at: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          author_name?: string | null
          author_role?: Database["public"]["Enums"]["support_author_role"]
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          read_at?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          author_name?: string | null
          author_role?: Database["public"]["Enums"]["support_author_role"]
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          read_at?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          attachments: Json
          category: Database["public"]["Enums"]["support_ticket_category"]
          channel: Database["public"]["Enums"]["support_channel"]
          closed_at: string | null
          created_at: string
          department: string
          first_response_at: string | null
          id: string
          last_reply_at: string | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          requester_email: string | null
          requester_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          store_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: Json
          category?: Database["public"]["Enums"]["support_ticket_category"]
          channel?: Database["public"]["Enums"]["support_channel"]
          closed_at?: string | null
          created_at?: string
          department?: string
          first_response_at?: string | null
          id?: string
          last_reply_at?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          requester_email?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          store_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: Json
          category?: Database["public"]["Enums"]["support_ticket_category"]
          channel?: Database["public"]["Enums"]["support_channel"]
          closed_at?: string | null
          created_at?: string
          department?: string
          first_response_at?: string | null
          id?: string
          last_reply_at?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          requester_email?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          store_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_classes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_classes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rules: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          priority: number
          rate: number
          region: string | null
          store_id: string
          tax_class_id: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          rate?: number
          region?: string | null
          store_id: string
          tax_class_id?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          rate?: number
          region?: string | null
          store_id?: string
          tax_class_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rules_tax_class_id_fkey"
            columns: ["tax_class_id"]
            isOneToOne: false
            referencedRelation: "tax_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_accounts: {
        Row: {
          ai_confidence_threshold: number
          auto_comment_dm_enabled: boolean
          autonomous_ai_enabled: boolean
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          live_automation_enabled: boolean
          open_id: string
          scopes: string[]
          status: string
          status_message: string | null
          store_id: string
          token_expires_at: string | null
          union_id: string | null
          updated_at: string
          username: string | null
          verify_token: string
        }
        Insert: {
          ai_confidence_threshold?: number
          auto_comment_dm_enabled?: boolean
          autonomous_ai_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          live_automation_enabled?: boolean
          open_id: string
          scopes?: string[]
          status?: string
          status_message?: string | null
          store_id: string
          token_expires_at?: string | null
          union_id?: string | null
          updated_at?: string
          username?: string | null
          verify_token?: string
        }
        Update: {
          ai_confidence_threshold?: number
          auto_comment_dm_enabled?: boolean
          autonomous_ai_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          live_automation_enabled?: boolean
          open_id?: string
          scopes?: string[]
          status?: string
          status_message?: string | null
          store_id?: string
          token_expires_at?: string | null
          union_id?: string | null
          updated_at?: string
          username?: string | null
          verify_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_comment_rules: {
        Row: {
          conversion_count: number
          created_at: string
          dm_sent_count: number
          dm_template: string
          id: string
          is_active: boolean
          keywords: string[]
          match_type: string
          name: string
          pin_product_card: boolean
          priority: number
          product_id: string | null
          public_reply: string
          reply_to_comment: boolean
          send_product_card: boolean
          source: string
          store_id: string
          target_video_id: string | null
          triggered_count: number
          updated_at: string
        }
        Insert: {
          conversion_count?: number
          created_at?: string
          dm_sent_count?: number
          dm_template?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_type?: string
          name: string
          pin_product_card?: boolean
          priority?: number
          product_id?: string | null
          public_reply?: string
          reply_to_comment?: boolean
          send_product_card?: boolean
          source?: string
          store_id: string
          target_video_id?: string | null
          triggered_count?: number
          updated_at?: string
        }
        Update: {
          conversion_count?: number
          created_at?: string
          dm_sent_count?: number
          dm_template?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_type?: string
          name?: string
          pin_product_card?: boolean
          priority?: number
          product_id?: string | null
          public_reply?: string
          reply_to_comment?: boolean
          send_product_card?: boolean
          source?: string
          store_id?: string
          target_video_id?: string | null
          triggered_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_comment_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_comment_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_credentials: {
        Row: {
          access_token: string
          account_id: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_expires_at: string | null
          refresh_token: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_expires_at?: string | null
          refresh_token?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_expires_at?: string | null
          refresh_token?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_credentials_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_credentials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_events: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event_type: string
          external_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          status: string
          store_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          store_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_interactions: {
        Row: {
          comment_id: string | null
          conversation_id: string | null
          created_at: string
          dm_status: string
          error: string | null
          id: string
          kind: string
          live_room_id: string | null
          matched_keyword: string | null
          reply_status: string
          rule_id: string | null
          store_id: string
          text: string | null
          tiktok_user_id: string | null
          updated_at: string
          username: string | null
          video_id: string | null
        }
        Insert: {
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          dm_status?: string
          error?: string | null
          id?: string
          kind?: string
          live_room_id?: string | null
          matched_keyword?: string | null
          reply_status?: string
          rule_id?: string | null
          store_id: string
          text?: string | null
          tiktok_user_id?: string | null
          updated_at?: string
          username?: string | null
          video_id?: string | null
        }
        Update: {
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          dm_status?: string
          error?: string | null
          id?: string
          kind?: string
          live_room_id?: string | null
          matched_keyword?: string | null
          reply_status?: string
          rule_id?: string | null
          store_id?: string
          text?: string | null
          tiktok_user_id?: string | null
          updated_at?: string
          username?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_interactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "omni_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_interactions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "tiktok_comment_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_interactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_entries: {
        Row: {
          content_type: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          field: string | null
          id: string
          locale: string
          namespace: string
          provider: string | null
          source_value: string | null
          status: Database["public"]["Enums"]["translation_status"]
          store_id: string
          translated_value: string | null
          translation_key: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content_type?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          field?: string | null
          id?: string
          locale: string
          namespace?: string
          provider?: string | null
          source_value?: string | null
          status?: Database["public"]["Enums"]["translation_status"]
          store_id: string
          translated_value?: string | null
          translation_key: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content_type?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          field?: string | null
          id?: string
          locale?: string
          namespace?: string
          provider?: string | null
          source_value?: string | null
          status?: Database["public"]["Enums"]["translation_status"]
          store_id?: string
          translated_value?: string | null
          translation_key?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "translation_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_glossary: {
        Row: {
          created_at: string
          do_not_translate: boolean
          id: string
          locale: string | null
          notes: string | null
          store_id: string
          term: string
          translation: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          do_not_translate?: boolean
          id?: string
          locale?: string | null
          notes?: string | null
          store_id: string
          term: string
          translation?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          do_not_translate?: boolean
          id?: string
          locale?: string | null
          notes?: string | null
          store_id?: string
          term?: string
          translation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_glossary_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_job_items: {
        Row: {
          attempts: number
          content_type: string
          created_at: string
          entity_id: string | null
          error: string | null
          field: string | null
          id: string
          job_id: string
          locale: string
          source_value: string | null
          status: Database["public"]["Enums"]["translation_job_status"]
          store_id: string
          translated_value: string | null
          translation_key: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          content_type?: string
          created_at?: string
          entity_id?: string | null
          error?: string | null
          field?: string | null
          id?: string
          job_id: string
          locale: string
          source_value?: string | null
          status?: Database["public"]["Enums"]["translation_job_status"]
          store_id: string
          translated_value?: string | null
          translation_key: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          content_type?: string
          created_at?: string
          entity_id?: string | null
          error?: string | null
          field?: string | null
          id?: string
          job_id?: string
          locale?: string
          source_value?: string | null
          status?: Database["public"]["Enums"]["translation_job_status"]
          store_id?: string
          translated_value?: string | null
          translation_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "translation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_job_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_jobs: {
        Row: {
          content_types: string[]
          created_at: string
          created_by: string | null
          done_items: number
          error: string | null
          failed_items: number
          finished_at: string | null
          id: string
          source_locale: string
          started_at: string | null
          status: Database["public"]["Enums"]["translation_job_status"]
          store_id: string
          target_locales: string[]
          total_items: number
          updated_at: string
        }
        Insert: {
          content_types?: string[]
          created_at?: string
          created_by?: string | null
          done_items?: number
          error?: string | null
          failed_items?: number
          finished_at?: string | null
          id?: string
          source_locale: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["translation_job_status"]
          store_id: string
          target_locales?: string[]
          total_items?: number
          updated_at?: string
        }
        Update: {
          content_types?: string[]
          created_at?: string
          created_by?: string | null
          done_items?: number
          error?: string | null
          failed_items?: number
          finished_at?: string | null
          id?: string
          source_locale?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["translation_job_status"]
          store_id?: string
          target_locales?: string[]
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_memory: {
        Row: {
          approved: boolean
          created_at: string
          hits: number
          id: string
          source_hash: string
          source_locale: string
          source_text: string
          store_id: string
          target_locale: string
          target_text: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          hits?: number
          id?: string
          source_hash: string
          source_locale: string
          source_text: string
          store_id: string
          target_locale: string
          target_text: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          hits?: number
          id?: string
          source_hash?: string
          source_locale?: string
          source_text?: string
          store_id?: string
          target_locale?: string
          target_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_memory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_settings: {
        Row: {
          brand_voice: string
          created_at: string
          detect_browser_language: boolean
          do_not_translate: string[]
          enabled: boolean
          fallback_chain: string[]
          model: string
          provider: string
          show_missing: boolean
          store_id: string
          switcher_enabled: boolean
          switcher_style: string
          translate_slugs: boolean
          updated_at: string
          url_strategy: Database["public"]["Enums"]["translation_url_strategy"]
        }
        Insert: {
          brand_voice?: string
          created_at?: string
          detect_browser_language?: boolean
          do_not_translate?: string[]
          enabled?: boolean
          fallback_chain?: string[]
          model?: string
          provider?: string
          show_missing?: boolean
          store_id: string
          switcher_enabled?: boolean
          switcher_style?: string
          translate_slugs?: boolean
          updated_at?: string
          url_strategy?: Database["public"]["Enums"]["translation_url_strategy"]
        }
        Update: {
          brand_voice?: string
          created_at?: string
          detect_browser_language?: boolean
          do_not_translate?: string[]
          enabled?: boolean
          fallback_chain?: string[]
          model?: string
          provider?: string
          show_missing?: boolean
          store_id?: string
          switcher_enabled?: boolean
          switcher_style?: string
          translate_slugs?: boolean
          updated_at?: string
          url_strategy?: Database["public"]["Enums"]["translation_url_strategy"]
        }
        Relationships: [
          {
            foreignKeyName: "translation_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_usage: {
        Row: {
          characters: number
          cost: number
          created_at: string
          day: string
          id: string
          locale: string
          provider: string
          requests: number
          store_id: string
          updated_at: string
          words: number
        }
        Insert: {
          characters?: number
          cost?: number
          created_at?: string
          day?: string
          id?: string
          locale: string
          provider?: string
          requests?: number
          store_id: string
          updated_at?: string
          words?: number
        }
        Update: {
          characters?: number
          cost?: number
          created_at?: string
          day?: string
          id?: string
          locale?: string
          provider?: string
          requests?: number
          store_id?: string
          updated_at?: string
          words?: number
        }
        Relationships: [
          {
            foreignKeyName: "translation_usage_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_versions: {
        Row: {
          changed_by: string | null
          created_at: string
          entry_id: string | null
          id: string
          locale: string
          new_value: string | null
          old_value: string | null
          store_id: string
          translation_key: string
          version: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          locale: string
          new_value?: string | null
          old_value?: string | null
          store_id: string
          translation_key: string
          version?: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          locale?: string
          new_value?: string | null
          old_value?: string | null
          store_id?: string
          translation_key?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "translation_versions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "translation_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_versions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          created_at: string
          id: string
          meta: Json
          metric_key: string
          period_start: string
          quantity: number
          recorded_at: string
          store_id: string
          subscription_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          metric_key: string
          period_start?: string
          quantity?: number
          recorded_at?: string
          store_id: string
          subscription_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          metric_key?: string
          period_start?: string
          quantity?: number
          recorded_at?: string
          store_id?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_records_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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
      vendors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          slug: string
          store_id: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          slug: string
          store_id: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          slug?: string
          store_id?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          allows_fulfillment: boolean
          city: string | null
          code: string
          contact_name: string | null
          country: string
          created_at: string
          district: string | null
          external_ref: string | null
          external_source: string | null
          id: string
          is_active: boolean
          is_default: boolean
          kind: Database["public"]["Enums"]["warehouse_kind"]
          last_synced_at: string | null
          name: string
          note: string | null
          phone: string | null
          priority: number
          store_id: string
          supplier_id: string | null
          sync_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allows_fulfillment?: boolean
          city?: string | null
          code: string
          contact_name?: string | null
          country?: string
          created_at?: string
          district?: string | null
          external_ref?: string | null
          external_source?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: Database["public"]["Enums"]["warehouse_kind"]
          last_synced_at?: string | null
          name: string
          note?: string | null
          phone?: string | null
          priority?: number
          store_id: string
          supplier_id?: string | null
          sync_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allows_fulfillment?: boolean
          city?: string | null
          code?: string
          contact_name?: string | null
          country?: string
          created_at?: string
          district?: string | null
          external_ref?: string | null
          external_source?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          kind?: Database["public"]["Enums"]["warehouse_kind"]
          last_synced_at?: string | null
          name?: string
          note?: string | null
          phone?: string | null
          priority?: number
          store_id?: string
          supplier_id?: string | null
          sync_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string | null
          duration_ms: number | null
          error_message: string | null
          event: string
          id: string
          manual_retry: boolean
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          signature: string | null
          status: Database["public"]["Enums"]["webhook_delivery_status"]
          store_id: string
          webhook_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event: string
          id?: string
          manual_retry?: boolean
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          store_id: string
          webhook_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event?: string
          id?: string
          manual_retry?: boolean
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          store_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "store_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          auto_reply_enabled: boolean
          business_name: string | null
          created_at: string
          display_phone: string
          id: string
          phone_number_id: string
          status: string
          store_id: string
          updated_at: string
          verify_token: string
          waba_id: string | null
        }
        Insert: {
          auto_reply_enabled?: boolean
          business_name?: string | null
          created_at?: string
          display_phone: string
          id?: string
          phone_number_id: string
          status?: string
          store_id: string
          updated_at?: string
          verify_token?: string
          waba_id?: string | null
        }
        Update: {
          auto_reply_enabled?: boolean
          business_name?: string | null
          created_at?: string
          display_phone?: string
          id?: string
          phone_number_id?: string
          status?: string
          store_id?: string
          updated_at?: string
          verify_token?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_auto_replies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          match_type: string
          reply_body: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          match_type?: string
          reply_body: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          match_type?: string
          reply_body?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_auto_replies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          contact_name: string | null
          created_at: string
          customer_id: string | null
          id: string
          last_message_at: string
          last_message_preview: string | null
          status: string
          store_id: string
          unread_count: number
          updated_at: string
          wa_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          store_id: string
          unread_count?: number
          updated_at?: string
          wa_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          store_id?: string
          unread_count?: number
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["whatsapp_direction"]
          id: string
          message_type: string
          payload: Json
          status: Database["public"]["Enums"]["message_delivery_status"]
          store_id: string
          template_name: string | null
          wa_message_id: string | null
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["whatsapp_direction"]
          id?: string
          message_type?: string
          payload?: Json
          status?: Database["public"]["Enums"]["message_delivery_status"]
          store_id: string
          template_name?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["whatsapp_direction"]
          id?: string
          message_type?: string
          payload?: Json
          status?: Database["public"]["Enums"]["message_delivery_status"]
          store_id?: string
          template_name?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cache_get: { Args: { _key: string }; Returns: Json }
      cache_invalidate: {
        Args: { _namespace?: string; _prefix?: string; _store_id?: string }
        Returns: number
      }
      cache_set: {
        Args: {
          _key: string
          _namespace: string
          _store_id?: string
          _ttl_seconds: number
          _value: Json
        }
        Returns: undefined
      }
      claim_jobs: {
        Args: {
          _kinds?: Database["public"]["Enums"]["job_kind"][]
          _limit?: number
        }
        Returns: {
          attempts: number
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          finished_at: string | null
          id: string
          kind: Database["public"]["Enums"]["job_kind"]
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          payload: Json
          priority: number
          result: Json | null
          run_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          store_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_job: {
        Args: { _id: string; _result?: Json }
        Returns: undefined
      }
      consume_rate_limit: {
        Args: { _bucket_key: string; _limit: number; _window_seconds: number }
        Returns: Json
      }
      customer_fts_text: {
        Args: { _email: string; _full_name: string; _phone: string }
        Returns: string
      }
      emit_notification: {
        Args: {
          _entity?: string
          _entity_id?: string
          _kind: Database["public"]["Enums"]["notification_kind"]
          _message?: string
          _meta?: Json
          _store_id: string
          _title: string
        }
        Returns: string
      }
      enqueue_job: {
        Args: {
          _dedupe_key?: string
          _kind: Database["public"]["Enums"]["job_kind"]
          _max_attempts?: number
          _payload?: Json
          _priority?: number
          _run_at?: string
          _store_id?: string
        }
        Returns: string
      }
      ensure_ledger_account: {
        Args: {
          _currency?: string
          _customer_id?: string
          _kind: Database["public"]["Enums"]["ledger_account_kind"]
          _name?: string
          _seller_id?: string
          _store_id: string
        }
        Returns: string
      }
      fail_job: { Args: { _error: string; _id: string }; Returns: undefined }
      fts_simple: { Args: { _text: string }; Returns: unknown }
      ledger_account_balance: { Args: { _account_id: string }; Returns: number }
      ledger_store_balances: {
        Args: { _store_id: string }
        Returns: {
          account_id: string
          account_kind: Database["public"]["Enums"]["ledger_account_kind"]
          account_name: string
          balance: number
          credit: number
          currency: string
          debit: number
          pending: number
          seller_id: string
        }[]
      }
      order_fts_text: {
        Args: {
          _customer_email: string
          _customer_name: string
          _customer_phone: string
          _invoice_number: string
          _order_number: string
          _tracking_number: string
        }
        Returns: string
      }
      page_fts_text: {
        Args: { _body: string; _excerpt: string; _slug: string; _title: string }
        Returns: string
      }
      product_fts_text: {
        Args: {
          _barcode: string
          _description: string
          _sku: string
          _slug: string
          _title: string
          _vendor: string
        }
        Returns: string
      }
      publish_due_blog_posts: { Args: never; Returns: number }
      publish_theme_version: {
        Args: { _label?: string; _store_id: string }
        Returns: string
      }
      restore_theme_version: {
        Args: { _version_id: string }
        Returns: undefined
      }
      rollup_store_daily_stats: {
        Args: { target_day?: string }
        Returns: number
      }
      search_store: {
        Args: {
          _kinds?: string[]
          _limit?: number
          _store_id: string
          _term: string
        }
        Returns: {
          id: string
          kind: string
          rank: number
          subtitle: string
          title: string
        }[]
      }
      seed_demo_store: { Args: { _store_id: string }; Returns: Json }
    }
    Enums: {
      app_category:
        | "seo"
        | "marketing"
        | "payment"
        | "shipping"
        | "accounting"
        | "crm"
        | "analytics"
        | "social"
        | "email"
        | "sms"
        | "whatsapp"
        | "ai"
        | "reviews"
        | "loyalty"
        | "dropshipping"
        | "marketplace"
      app_install_status: "installed" | "paused" | "uninstalled"
      app_pricing_model: "free" | "monthly" | "one_time" | "usage"
      app_role: "platform_admin" | "agency" | "seller" | "customer"
      automation_condition:
        | "order_placed"
        | "order_paid"
        | "email_opened"
        | "has_tag"
        | "cart_still_active"
      automation_run_status:
        | "active"
        | "waiting"
        | "completed"
        | "stopped"
        | "failed"
      automation_step_kind:
        | "wait"
        | "email"
        | "sms"
        | "whatsapp"
        | "push"
        | "condition"
        | "end"
      automation_trigger:
        | "cart_abandoned"
        | "order_placed"
        | "order_paid"
        | "order_shipped"
        | "order_delivered"
        | "customer_created"
        | "back_in_stock"
        | "review_received"
        | "manual"
      billing_cycle_status: "open" | "closed" | "invoiced"
      billing_interval: "monthly" | "yearly"
      channel_status: "disconnected" | "connected" | "error" | "paused"
      connector_kind: "payment" | "shipping"
      discount_type: "percentage" | "fixed_amount" | "free_shipping"
      domain_status: "pending" | "verifying" | "verified" | "failed"
      domain_type: "subdomain" | "custom"
      dropship_order_status:
        | "pending"
        | "sent"
        | "accepted"
        | "shipped"
        | "cancelled"
        | "failed"
      fulfillment_status:
        | "unfulfilled"
        | "partially_fulfilled"
        | "fulfilled"
        | "returned"
      inventory_movement_kind:
        | "count"
        | "restock"
        | "manual_out"
        | "sale"
        | "return"
        | "damage"
        | "transfer_out"
        | "transfer_in"
        | "reserve"
        | "release"
      invoice_status: "draft" | "open" | "paid" | "void" | "uncollectible"
      job_kind:
        | "email"
        | "sms"
        | "whatsapp"
        | "image"
        | "feed_sync"
        | "marketplace_sync"
        | "webhook"
        | "analytics"
        | "ai"
        | "sitemap"
        | "invoice"
      job_status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
      ledger_account_kind:
        | "store"
        | "seller"
        | "platform"
        | "customer"
        | "payment_provider"
        | "gateway"
      ledger_direction: "credit" | "debit"
      ledger_entry_kind:
        | "sale"
        | "shipping"
        | "discount"
        | "platform_fee"
        | "payment_fee"
        | "refund"
        | "payout"
        | "adjustment"
        | "customer_payment"
        | "seller_earning"
        | "marketplace_commission"
        | "withdrawal"
        | "wallet_in"
        | "wallet_out"
      ledger_entry_status: "pending" | "posted" | "cancelled" | "failed"
      listing_status: "draft" | "queued" | "listed" | "error" | "removed"
      markup_type: "none" | "fixed" | "percent"
      message_channel: "email" | "sms" | "whatsapp" | "push"
      message_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
      notification_kind:
        | "order"
        | "inventory"
        | "payout"
        | "system"
        | "abandoned_cart"
        | "review"
        | "question"
        | "payment"
        | "payment_failed"
        | "customer"
        | "subscription"
        | "app_update"
      order_status:
        | "pending"
        | "awaiting_payment"
        | "paid"
        | "processing"
        | "packed"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned"
        | "refunded"
      payment_status:
        | "pending"
        | "paid"
        | "partially_refunded"
        | "refunded"
        | "failed"
      payout_status: "pending" | "processing" | "paid" | "failed"
      price_source:
        | "base"
        | "auto"
        | "manual"
        | "price_list"
        | "campaign"
        | "rule"
      product_status: "draft" | "active" | "archived"
      rate_update_frequency: "manual" | "hourly" | "six_hourly" | "daily"
      return_reason:
        | "damaged"
        | "wrong_item"
        | "not_as_described"
        | "size_fit"
        | "changed_mind"
        | "other"
      return_status:
        | "requested"
        | "approved"
        | "rejected"
        | "received"
        | "refunded"
        | "cancelled"
      review_status: "pending" | "published" | "rejected"
      rounding_mode:
        | "none"
        | "nearest_0_01"
        | "nearest_0_05"
        | "nearest_0_10"
        | "nearest_1"
        | "nearest_5"
        | "nearest_10"
        | "psych_99"
        | "psych_90"
        | "psych_95"
      seller_status: "pending" | "approved" | "rejected" | "suspended"
      shipment_status:
        | "pending"
        | "in_transit"
        | "delivered"
        | "returned"
        | "cancelled"
      stock_transfer_status: "draft" | "in_transit" | "received" | "cancelled"
      store_role: "owner" | "admin" | "staff" | "marketing" | "support"
      store_status: "draft" | "active" | "suspended" | "archived"
      subscription_item_kind: "plan" | "addon" | "usage"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
      supplier_feed_kind: "xml" | "csv" | "api"
      supplier_feed_run_status: "running" | "success" | "failed"
      supplier_feed_schedule: "manual" | "hourly" | "six_hourly" | "daily"
      supplier_match_key: "sku" | "barcode" | "external_id"
      support_author_role: "customer" | "store" | "platform" | "system"
      support_channel: "ticket" | "chat" | "email"
      support_ticket_category:
        | "billing"
        | "technical"
        | "account"
        | "store"
        | "marketplace"
        | "api"
        | "other"
      support_ticket_priority: "low" | "normal" | "high" | "urgent"
      support_ticket_status:
        | "open"
        | "pending"
        | "answered"
        | "resolved"
        | "closed"
      translation_job_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      translation_status:
        | "missing"
        | "machine"
        | "needs_review"
        | "translated"
        | "approved"
      translation_url_strategy: "subdirectory" | "subdomain" | "domain"
      warehouse_kind:
        | "warehouse"
        | "branch"
        | "supplier"
        | "dropship"
        | "virtual"
      webhook_delivery_status: "pending" | "success" | "failed"
      whatsapp_direction: "inbound" | "outbound"
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
      app_category: [
        "seo",
        "marketing",
        "payment",
        "shipping",
        "accounting",
        "crm",
        "analytics",
        "social",
        "email",
        "sms",
        "whatsapp",
        "ai",
        "reviews",
        "loyalty",
        "dropshipping",
        "marketplace",
      ],
      app_install_status: ["installed", "paused", "uninstalled"],
      app_pricing_model: ["free", "monthly", "one_time", "usage"],
      app_role: ["platform_admin", "agency", "seller", "customer"],
      automation_condition: [
        "order_placed",
        "order_paid",
        "email_opened",
        "has_tag",
        "cart_still_active",
      ],
      automation_run_status: [
        "active",
        "waiting",
        "completed",
        "stopped",
        "failed",
      ],
      automation_step_kind: [
        "wait",
        "email",
        "sms",
        "whatsapp",
        "push",
        "condition",
        "end",
      ],
      automation_trigger: [
        "cart_abandoned",
        "order_placed",
        "order_paid",
        "order_shipped",
        "order_delivered",
        "customer_created",
        "back_in_stock",
        "review_received",
        "manual",
      ],
      billing_cycle_status: ["open", "closed", "invoiced"],
      billing_interval: ["monthly", "yearly"],
      channel_status: ["disconnected", "connected", "error", "paused"],
      connector_kind: ["payment", "shipping"],
      discount_type: ["percentage", "fixed_amount", "free_shipping"],
      domain_status: ["pending", "verifying", "verified", "failed"],
      domain_type: ["subdomain", "custom"],
      dropship_order_status: [
        "pending",
        "sent",
        "accepted",
        "shipped",
        "cancelled",
        "failed",
      ],
      fulfillment_status: [
        "unfulfilled",
        "partially_fulfilled",
        "fulfilled",
        "returned",
      ],
      inventory_movement_kind: [
        "count",
        "restock",
        "manual_out",
        "sale",
        "return",
        "damage",
        "transfer_out",
        "transfer_in",
        "reserve",
        "release",
      ],
      invoice_status: ["draft", "open", "paid", "void", "uncollectible"],
      job_kind: [
        "email",
        "sms",
        "whatsapp",
        "image",
        "feed_sync",
        "marketplace_sync",
        "webhook",
        "analytics",
        "ai",
        "sitemap",
        "invoice",
      ],
      job_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      ledger_account_kind: [
        "store",
        "seller",
        "platform",
        "customer",
        "payment_provider",
        "gateway",
      ],
      ledger_direction: ["credit", "debit"],
      ledger_entry_kind: [
        "sale",
        "shipping",
        "discount",
        "platform_fee",
        "payment_fee",
        "refund",
        "payout",
        "adjustment",
        "customer_payment",
        "seller_earning",
        "marketplace_commission",
        "withdrawal",
        "wallet_in",
        "wallet_out",
      ],
      ledger_entry_status: ["pending", "posted", "cancelled", "failed"],
      listing_status: ["draft", "queued", "listed", "error", "removed"],
      markup_type: ["none", "fixed", "percent"],
      message_channel: ["email", "sms", "whatsapp", "push"],
      message_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      notification_kind: [
        "order",
        "inventory",
        "payout",
        "system",
        "abandoned_cart",
        "review",
        "question",
        "payment",
        "payment_failed",
        "customer",
        "subscription",
        "app_update",
      ],
      order_status: [
        "pending",
        "awaiting_payment",
        "paid",
        "processing",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
        "refunded",
      ],
      payment_status: [
        "pending",
        "paid",
        "partially_refunded",
        "refunded",
        "failed",
      ],
      payout_status: ["pending", "processing", "paid", "failed"],
      price_source: [
        "base",
        "auto",
        "manual",
        "price_list",
        "campaign",
        "rule",
      ],
      product_status: ["draft", "active", "archived"],
      rate_update_frequency: ["manual", "hourly", "six_hourly", "daily"],
      return_reason: [
        "damaged",
        "wrong_item",
        "not_as_described",
        "size_fit",
        "changed_mind",
        "other",
      ],
      return_status: [
        "requested",
        "approved",
        "rejected",
        "received",
        "refunded",
        "cancelled",
      ],
      review_status: ["pending", "published", "rejected"],
      rounding_mode: [
        "none",
        "nearest_0_01",
        "nearest_0_05",
        "nearest_0_10",
        "nearest_1",
        "nearest_5",
        "nearest_10",
        "psych_99",
        "psych_90",
        "psych_95",
      ],
      seller_status: ["pending", "approved", "rejected", "suspended"],
      shipment_status: [
        "pending",
        "in_transit",
        "delivered",
        "returned",
        "cancelled",
      ],
      stock_transfer_status: ["draft", "in_transit", "received", "cancelled"],
      store_role: ["owner", "admin", "staff", "marketing", "support"],
      store_status: ["draft", "active", "suspended", "archived"],
      subscription_item_kind: ["plan", "addon", "usage"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
      supplier_feed_kind: ["xml", "csv", "api"],
      supplier_feed_run_status: ["running", "success", "failed"],
      supplier_feed_schedule: ["manual", "hourly", "six_hourly", "daily"],
      supplier_match_key: ["sku", "barcode", "external_id"],
      support_author_role: ["customer", "store", "platform", "system"],
      support_channel: ["ticket", "chat", "email"],
      support_ticket_category: [
        "billing",
        "technical",
        "account",
        "store",
        "marketplace",
        "api",
        "other",
      ],
      support_ticket_priority: ["low", "normal", "high", "urgent"],
      support_ticket_status: [
        "open",
        "pending",
        "answered",
        "resolved",
        "closed",
      ],
      translation_job_status: [
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      translation_status: [
        "missing",
        "machine",
        "needs_review",
        "translated",
        "approved",
      ],
      translation_url_strategy: ["subdirectory", "subdomain", "domain"],
      warehouse_kind: [
        "warehouse",
        "branch",
        "supplier",
        "dropship",
        "virtual",
      ],
      webhook_delivery_status: ["pending", "success", "failed"],
      whatsapp_direction: ["inbound", "outbound"],
    },
  },
} as const
