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
      customers: {
        Row: {
          accepts_marketing: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
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
          full_name: string
          id?: string
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
          full_name?: string
          id?: string
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
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          id: string
          kind: Database["public"]["Enums"]["ledger_entry_kind"]
          meta: Json
          occurred_at: string
          order_id: string | null
          payout_id: string | null
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          kind: Database["public"]["Enums"]["ledger_entry_kind"]
          meta?: Json
          occurred_at?: string
          order_id?: string | null
          payout_id?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          kind?: Database["public"]["Enums"]["ledger_entry_kind"]
          meta?: Json
          occurred_at?: string
          order_id?: string | null
          payout_id?: string | null
          store_id?: string
        }
        Relationships: [
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
            foreignKeyName: "ledger_entries_store_id_fkey"
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
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          grand_total: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          note: string | null
          order_number: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          placed_at: string
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
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          note?: string | null
          order_number: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
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
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          grand_total?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          note?: string | null
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
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
            foreignKeyName: "orders_store_id_fkey"
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
          tax_rate: number
          title: string
          track_inventory: boolean
          updated_at: string
          variant_options: Json
          vendor: string | null
          video_url: string | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          base_price?: number
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
          tax_rate?: number
          title: string
          track_inventory?: boolean
          updated_at?: string
          variant_options?: Json
          vendor?: string | null
          video_url?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          base_price?: number
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
          tax_rate?: number
          title?: string
          track_inventory?: boolean
          updated_at?: string
          variant_options?: Json
          vendor?: string | null
          video_url?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: [
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
      store_menu_items: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          kind: string
          label: string
          location: string
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
          position?: number
          store_id?: string
          target?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_menu_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pages: {
        Row: {
          author_name: string | null
          body: string
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean
          page_kind: string
          published_at: string | null
          seo: Json
          seo_description: string | null
          show_in_footer: boolean
          slug: string
          sort_order: number
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          body?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          page_kind?: string
          published_at?: string | null
          seo?: Json
          seo_description?: string | null
          show_in_footer?: boolean
          slug: string
          sort_order?: number
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          body?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          page_kind?: string
          published_at?: string | null
          seo?: Json
          seo_description?: string | null
          show_in_footer?: boolean
          slug?: string
          sort_order?: number
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
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
      store_settings: {
        Row: {
          address: Json
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_tax_rate: number
          guest_checkout: boolean
          legal_name: string | null
          seo: Json
          social: Json
          store_id: string
          tax_included_prices: boolean
          tax_number: string | null
          updated_at: string
          weight_unit: string
        }
        Insert: {
          address?: Json
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_tax_rate?: number
          guest_checkout?: boolean
          legal_name?: string | null
          seo?: Json
          social?: Json
          store_id: string
          tax_included_prices?: boolean
          tax_number?: string | null
          updated_at?: string
          weight_unit?: string
        }
        Update: {
          address?: Json
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_tax_rate?: number
          guest_checkout?: boolean
          legal_name?: string | null
          seo?: Json
          social?: Json
          store_id?: string
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
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          phone: string | null
          store_id: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          phone?: string | null
          store_id: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          phone?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rollup_store_daily_stats: {
        Args: { target_day?: string }
        Returns: number
      }
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
      app_install_status: "installed" | "paused" | "uninstalled"
      app_pricing_model: "free" | "monthly" | "one_time" | "usage"
      app_role: "platform_admin" | "agency" | "seller" | "customer"
      billing_cycle_status: "open" | "closed" | "invoiced"
      billing_interval: "monthly" | "yearly"
      channel_status: "disconnected" | "connected" | "error" | "paused"
      connector_kind: "payment" | "shipping"
      discount_type: "percentage" | "fixed_amount" | "free_shipping"
      domain_status: "pending" | "verifying" | "verified" | "failed"
      domain_type: "subdomain" | "custom"
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
      listing_status: "draft" | "queued" | "listed" | "error" | "removed"
      notification_kind:
        | "order"
        | "inventory"
        | "payout"
        | "system"
        | "abandoned_cart"
        | "review"
        | "question"
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
      product_status: "draft" | "active" | "archived"
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
      warehouse_kind:
        | "warehouse"
        | "branch"
        | "supplier"
        | "dropship"
        | "virtual"
      webhook_delivery_status: "pending" | "success" | "failed"
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
      ],
      app_install_status: ["installed", "paused", "uninstalled"],
      app_pricing_model: ["free", "monthly", "one_time", "usage"],
      app_role: ["platform_admin", "agency", "seller", "customer"],
      billing_cycle_status: ["open", "closed", "invoiced"],
      billing_interval: ["monthly", "yearly"],
      channel_status: ["disconnected", "connected", "error", "paused"],
      connector_kind: ["payment", "shipping"],
      discount_type: ["percentage", "fixed_amount", "free_shipping"],
      domain_status: ["pending", "verifying", "verified", "failed"],
      domain_type: ["subdomain", "custom"],
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
      ],
      listing_status: ["draft", "queued", "listed", "error", "removed"],
      notification_kind: [
        "order",
        "inventory",
        "payout",
        "system",
        "abandoned_cart",
        "review",
        "question",
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
      product_status: ["draft", "active", "archived"],
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
      warehouse_kind: [
        "warehouse",
        "branch",
        "supplier",
        "dropship",
        "virtual",
      ],
      webhook_delivery_status: ["pending", "success", "failed"],
    },
  },
} as const
