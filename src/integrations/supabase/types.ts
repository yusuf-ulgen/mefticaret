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
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
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
          variant_id: string | null
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
          variant_id?: string | null
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
          variant_id?: string | null
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
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
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
          discount_code: string | null
          discount_total: number
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          grand_total: number
          id: string
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
          discount_code?: string | null
          discount_total?: number
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          grand_total?: number
          id?: string
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
          discount_code?: string | null
          discount_total?: number
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          grand_total?: number
          id?: string
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
      plans: {
        Row: {
          code: string
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
          store_id: string
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id: string
          store_id: string
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id?: string
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
      product_variants: {
        Row: {
          barcode: string | null
          cost_price: number | null
          created_at: string
          id: string
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
          cost_price?: number | null
          created_at?: string
          id?: string
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
          cost_price?: number | null
          created_at?: string
          id?: string
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
          base_price: number
          compare_at_price: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          product_type: string | null
          seo: Json
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          store_id: string
          tags: string[]
          title: string
          track_inventory: boolean
          updated_at: string
          vendor: string | null
        }
        Insert: {
          base_price?: number
          compare_at_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          product_type?: string | null
          seo?: Json
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          store_id: string
          tags?: string[]
          title: string
          track_inventory?: boolean
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          base_price?: number
          compare_at_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          product_type?: string | null
          seo?: Json
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          store_id?: string
          tags?: string[]
          title?: string
          track_inventory?: boolean
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
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
          hostname: string
          id: string
          is_primary: boolean
          ssl_active: boolean
          status: Database["public"]["Enums"]["domain_status"]
          store_id: string
          type: Database["public"]["Enums"]["domain_type"]
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          is_primary?: boolean
          ssl_active?: boolean
          status?: Database["public"]["Enums"]["domain_status"]
          store_id: string
          type?: Database["public"]["Enums"]["domain_type"]
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          ssl_active?: boolean
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
      store_themes: {
        Row: {
          accent_color: string
          announcement: string | null
          background_color: string
          created_at: string
          font_pair: string
          hero_cta_label: string
          hero_subtitle: string
          hero_title: string
          is_published: boolean
          layout: string
          preset: string
          primary_color: string
          published_at: string | null
          radius: number
          show_announcement: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          announcement?: string | null
          background_color?: string
          created_at?: string
          font_pair?: string
          hero_cta_label?: string
          hero_subtitle?: string
          hero_title?: string
          is_published?: boolean
          layout?: string
          preset?: string
          primary_color?: string
          published_at?: string | null
          radius?: number
          show_announcement?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          announcement?: string | null
          background_color?: string
          created_at?: string
          font_pair?: string
          hero_cta_label?: string
          hero_subtitle?: string
          hero_title?: string
          is_published?: boolean
          layout?: string
          preset?: string
          primary_color?: string
          published_at?: string | null
          radius?: number
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
      [_ in never]: never
    }
    Enums: {
      app_role: "platform_admin" | "agency" | "seller" | "customer"
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
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      payment_status:
        | "pending"
        | "paid"
        | "partially_refunded"
        | "refunded"
        | "failed"
      product_status: "draft" | "active" | "archived"
      store_role: "owner" | "admin" | "staff" | "marketing" | "support"
      store_status: "draft" | "active" | "suspended" | "archived"
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
      app_role: ["platform_admin", "agency", "seller", "customer"],
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
      ],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      payment_status: [
        "pending",
        "paid",
        "partially_refunded",
        "refunded",
        "failed",
      ],
      product_status: ["draft", "active", "archived"],
      store_role: ["owner", "admin", "staff", "marketing", "support"],
      store_status: ["draft", "active", "suspended", "archived"],
    },
  },
} as const
