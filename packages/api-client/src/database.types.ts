/**
 * Hand-written stand-in for the Supabase-generated types.
 * Replace by running `npm run types:generate` in packages/database once a
 * local or hosted Supabase project is available (see packages/database/package.json).
 *
 * `Relationships: []` on every table and the empty Views/Functions/Enums/
 * CompositeTypes are required for @supabase/supabase-js's generic client to
 * infer row types correctly — without them every query resolves to `never`.
 */
/** Mirrors the `sklad_batch_status` enum (0011); named here because both the
 * table row and the sklad_batch_page RPC signature need it. */
export type SkladBatchStatusValue =
  'tayyor' | 'qadoqlanmoqda' | 'omborda' | 'rezerv' | 'jonatildi' | 'qaytarildi' | 'brak';

/** Mirrors the `sklad_invoice_status` enum (0027). */
export type SkladInvoiceStatusValue = 'yangi' | 'qisman' | 'bajarildi' | 'bekor';

/** Mirrors the `sklad_order_status` enum (0024). */
export type SkladOrderStatusValue =
  'yangi' | 'ishlab_chiqarishda' | 'tayyor' | 'yuklandi' | 'yopilgan';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          base_currency: string;
          subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['organizations']['Row']> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Row']>;
        Relationships: [];
      };
      counterparties: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          phone: string | null;
          categories: string[];
          notes: string | null;
          currency: string | null;
          manager_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['counterparties']['Row']> & {
          org_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['counterparties']['Row']>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          org_id: string;
          code: string;
          name: string;
          type: 'receivable' | 'cash' | 'sales' | 'inventory' | 'other';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['accounts']['Row']> & {
          org_id: string;
          code: string;
          name: string;
          type: 'receivable' | 'cash' | 'sales' | 'inventory' | 'other';
        };
        Update: Partial<Database['public']['Tables']['accounts']['Row']>;
        Relationships: [];
      };
      transaction_categories: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          unit: string | null;
          default_debit_account_id: string | null;
          default_credit_account_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['transaction_categories']['Row']> & {
          org_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['transaction_categories']['Row']>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          org_id: string;
          counterparty_id: string;
          category_id: string | null;
          document_no: string | null;
          occurred_at: string;
          due_date: string | null;
          description: string | null;
          quantity: number | null;
          unit: string | null;
          quantity_kg: number | null;
          quantity_dona: number | null;
          debit_account_id: string;
          debit_amount: number;
          credit_account_id: string;
          credit_amount: number;
          currency: string;
          source: 'fabrika' | 'shaxsiy';
          created_by: string | null;
          status: 'draft' | 'posted' | 'reversed' | 'reversal';
          reversal_of_id: string | null;
          reversed_by_id: string | null;
          reversal_reason: string | null;
          posted_at: string | null;
          exchange_rate: number | null;
          base_debit_amount: number | null;
          base_credit_amount: number | null;
          client_local_id: string | null;
          synced_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['transactions']['Row']> & {
          org_id: string;
          counterparty_id: string;
          debit_account_id: string;
          debit_amount: number;
          credit_account_id: string;
          credit_amount: number;
          currency: string;
          source: 'fabrika' | 'shaxsiy';
        };
        Update: Partial<Database['public']['Tables']['transactions']['Row']>;
        Relationships: [];
      };
      memberships: {
        Row: {
          org_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'staff';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['memberships']['Row']> & {
          org_id: string;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['memberships']['Row']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          role_platform: 'user' | 'platform_admin';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      currencies: {
        Row: { code: string; symbol: string; precision: number; created_at: string };
        Insert: Partial<Database['public']['Tables']['currencies']['Row']> & {
          code: string;
          symbol: string;
        };
        Update: Partial<Database['public']['Tables']['currencies']['Row']>;
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          id: string;
          org_id: string;
          from_code: string;
          to_code: string;
          rate: number;
          effective_date: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['exchange_rates']['Row']> & {
          org_id: string;
          from_code: string;
          to_code: string;
          rate: number;
          effective_date: string;
        };
        Update: Partial<Database['public']['Tables']['exchange_rates']['Row']>;
        Relationships: [];
      };
      accounting_periods: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status: 'open' | 'closed';
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['accounting_periods']['Row']> & {
          org_id: string;
          name: string;
          start_date: string;
          end_date: string;
        };
        Update: Partial<Database['public']['Tables']['accounting_periods']['Row']>;
        Relationships: [];
      };
      modules: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['modules']['Row']> & {
          org_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['modules']['Row']>;
        Relationships: [];
      };
      sklad_lookups: {
        Row: {
          id: string;
          org_id: string;
          kind: 'mahsulot_turi' | 'ip_turi' | 'sort' | 'rang' | 'pantone';
          name: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_lookups']['Row']> & {
          org_id: string;
          kind: 'mahsulot_turi' | 'ip_turi' | 'sort' | 'rang' | 'pantone';
          name: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_lookups']['Row']>;
        Relationships: [];
      };
      sklad_items: {
        Row: {
          id: string;
          org_id: string;
          kod: string | null;
          name: string;
          product_type_id: string | null;
          yarn_type_id: string | null;
          gsm: number | null;
          // 0026: two numbers instead of a "70x130" lookup.
          width_cm: number | null;
          length_cm: number | null;
          sort_id: string | null;
          color_id: string | null;
          pantone_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_items']['Row']> & {
          org_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_items']['Row']>;
        Relationships: [];
      };
      sklad_orders: {
        Row: {
          id: string;
          org_id: string;
          order_no: string | null;
          order_name: string | null;
          counterparty_id: string | null;
          // 0024: the order became the document the whole factory writes into.
          manager_id: string | null;
          deadline: string | null;
          status: SkladOrderStatusValue;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_orders']['Row']> & {
          org_id: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_orders']['Row']>;
        Relationships: [];
      };
      sklad_batches: {
        Row: {
          id: string;
          org_id: string;
          item_id: string;
          order_id: string | null;
          brutto_kg: number | null;
          netto_kg: number | null;
          tara_kg: number | null;
          dona_soni: number | null;
          nabor_soni: number | null;
          qop_soni: number | null;
          piece_weight_kg: number | null;
          qoldiq_dona: number | null;
          ishlab_chiqarilgan_sana: string | null;
          omborga_kirgan_sana: string;
          status: SkladBatchStatusValue;
          qc_checked_by: string | null;
          qc_checked_at: string | null;
          defect_type: string | null;
          defect_qty: number | null;
          notes: string | null;
          location_sector: string | null;
          location_row: string | null;
          location_rack: string | null;
          location_shelf: string | null;
          created_by: string | null;
          created_at: string;
        };
        // tara_kg/piece_weight_kg are GENERATED ALWAYS columns — Postgres
        // rejects writes that supply them, so they're omitted here.
        Insert: Partial<
          Omit<Database['public']['Tables']['sklad_batches']['Row'], 'tara_kg' | 'piece_weight_kg'>
        > & {
          org_id: string;
          item_id: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['sklad_batches']['Row'], 'tara_kg' | 'piece_weight_kg'>
        >;
        Relationships: [];
      };
      sklad_batch_prices: {
        Row: {
          batch_id: string;
          org_id: string;
          price_per_kg: number | null;
          price_per_piece: number | null;
          price_per_set: number | null;
          total_amount: number | null;
          purchase_cost: number | null;
          profit_percent: number | null;
          profit_amount: number | null;
          currency: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_batch_prices']['Row']> & {
          batch_id: string;
          org_id: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_batch_prices']['Row']>;
        Relationships: [];
      };
      sklad_movements: {
        Row: {
          id: string;
          org_id: string;
          batch_id: string;
          kind: 'kirim' | 'chiqim' | 'qaytarish' | 'brak' | 'korrektirovka';
          /** Signed: what the movement did to the batch. */
          dona: number;
          kg: number | null;
          occurred_at: string;
          counterparty_id: string | null;
          order_id: string | null;
          note: string | null;
          is_initial: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_movements']['Row']> & {
          org_id: string;
          batch_id: string;
          kind: 'kirim' | 'chiqim' | 'qaytarish' | 'brak' | 'korrektirovka';
          dona: number;
        };
        Update: Partial<Database['public']['Tables']['sklad_movements']['Row']>;
        Relationships: [];
      };
      sklad_stages: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          position: number;
          is_final: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_stages']['Row']> & {
          org_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_stages']['Row']>;
        Relationships: [];
      };
      sklad_order_lines: {
        Row: {
          id: string;
          org_id: string;
          order_id: string;
          item_id: string | null;
          position: number;
          description: string | null;
          size_text: string | null;
          color_text: string | null;
          planned_dona: number | null;
          planned_kg: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_order_lines']['Row']> & {
          org_id: string;
          order_id: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_order_lines']['Row']>;
        Relationships: [];
      };
      sklad_stage_entries: {
        Row: {
          id: string;
          org_id: string;
          order_line_id: string;
          stage_id: string;
          qty_in: number | null;
          qty_out: number | null;
          defect_qty: number | null;
          kg: number | null;
          executor_id: string | null;
          executor_name: string | null;
          occurred_at: string;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_stage_entries']['Row']> & {
          org_id: string;
          order_line_id: string;
          stage_id: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_stage_entries']['Row']>;
        Relationships: [];
      };
      sklad_shipments: {
        Row: {
          id: string;
          org_id: string;
          order_id: string | null;
          counterparty_id: string | null;
          manager_id: string | null;
          document_no: string | null;
          shipped_at: string;
          note: string | null;
          invoice_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_shipments']['Row']> & {
          org_id: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_shipments']['Row']>;
        Relationships: [];
      };
      sklad_shipment_lines: {
        Row: {
          id: string;
          org_id: string;
          shipment_id: string;
          order_line_id: string | null;
          batch_id: string | null;
          dona: number;
          kg: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_shipment_lines']['Row']> & {
          org_id: string;
          shipment_id: string;
          dona: number;
        };
        Update: Partial<Database['public']['Tables']['sklad_shipment_lines']['Row']>;
        Relationships: [];
      };
      sklad_invoices: {
        Row: {
          id: string;
          org_id: string;
          invoice_no: string | null;
          barcode: string | null;
          counterparty_id: string;
          manager_id: string | null;
          order_id: string | null;
          issued_at: string;
          due_date: string | null;
          status: SkladInvoiceStatusValue;
          currency: string;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        // invoice_no and barcode are assigned by trigger (0027); supplying
        // them is allowed but the app never does.
        Insert: Partial<Database['public']['Tables']['sklad_invoices']['Row']> & {
          org_id: string;
          counterparty_id: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_invoices']['Row']>;
        Relationships: [];
      };
      sklad_invoice_lines: {
        Row: {
          id: string;
          org_id: string;
          invoice_id: string;
          item_id: string | null;
          batch_id: string | null;
          position: number;
          dona: number;
          kg: number | null;
          unit_price: number | null;
          amount: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_invoice_lines']['Row']> & {
          org_id: string;
          invoice_id: string;
          dona: number;
        };
        Update: Partial<Database['public']['Tables']['sklad_invoice_lines']['Row']>;
        Relationships: [];
      };
      sklad_audit: {
        Row: {
          id: number;
          org_id: string;
          entity:
            'batch' | 'item' | 'price' | 'order' | 'line' | 'stage_entry' | 'shipment' | 'invoice';
          entity_id: string;
          action: 'insert' | 'update' | 'delete';
          changed_by: string | null;
          changed_at: string;
          old_row: Record<string, unknown> | null;
          new_row: Record<string, unknown> | null;
        };
        // Written only by the SECURITY DEFINER trigger — there is no insert
        // policy, so an Insert type here would be a lie the compiler tells.
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      rename_module_category: {
        Args: { target_org_id: string; old_name: string; new_name: string };
        Returns: void;
      };
      remove_module_category: {
        Args: { target_org_id: string; name_to_remove: string };
        Returns: void;
      };
      create_employee: {
        Args: {
          target_org_id: string;
          p_email: string;
          p_password: string;
          p_full_name?: string | null;
          p_phone?: string | null;
          p_role?: 'admin' | 'staff';
        };
        Returns: string;
      };
      list_org_members: {
        Args: { target_org_id: string };
        Returns: {
          user_id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: 'owner' | 'admin' | 'staff';
          has_finance_pin: boolean;
          created_at: string;
        }[];
      };
      update_employee: {
        Args: {
          target_org_id: string;
          target_user_id: string;
          p_full_name?: string | null;
          p_phone?: string | null;
          p_avatar_url?: string | null;
        };
        Returns: void;
      };
      reset_employee_password: {
        Args: { target_org_id: string; target_user_id: string; p_password: string };
        Returns: void;
      };
      // Finance PIN (0020). verify/has take no target_user_id on purpose —
      // they read auth.uid()'s own membership row, so a PIN can only ever
      // confirm the caller, never stand in for another employee.
      admin_set_finance_pin: {
        Args: { target_org_id: string; target_user_id: string; pin: string };
        Returns: void;
      };
      admin_clear_finance_pin: {
        Args: { target_org_id: string; target_user_id: string };
        Returns: void;
      };
      set_finance_pin: {
        Args: { target_org_id: string; pin: string };
        Returns: void;
      };
      verify_finance_pin: {
        Args: { target_org_id: string; pin: string };
        Returns: boolean;
      };
      has_finance_pin: {
        Args: { target_org_id: string };
        Returns: boolean;
      };
      list_org_roster: {
        Args: { target_org_id: string };
        Returns: {
          user_id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
        }[];
      };
      list_transaction_audit: {
        Args: { target_org_id: string; p_limit?: number };
        Returns: {
          id: number;
          transaction_id: string;
          action: 'update' | 'delete';
          changed_at: string;
          changed_by_name: string | null;
          counterparty_name: string | null;
          document_no: string | null;
          occurred_at: string | null;
          old_amount: number | null;
          new_amount: number | null;
          old_description: string | null;
          new_description: string | null;
        }[];
      };
      get_exchange_rate: {
        Args: { target_org_id: string; p_from: string; p_to: string; target_date: string };
        Returns: number | null;
      };
      counterparty_balances: {
        Args: { target_org_id: string; p_as_of?: string | null };
        Returns: {
          counterparty_id: string;
          counterparty_name: string;
          balance: number;
          base_balance: number;
        }[];
      };
      counterparty_journal: {
        Args: {
          target_org_id: string;
          p_search?: string | null;
          p_manager_id?: string | null;
          p_currency?: string | null;
          p_only_debtors?: boolean | null;
          p_only_overdue?: boolean | null;
          p_as_of?: string | null;
        };
        Returns: {
          counterparty_id: string;
          counterparty_name: string;
          phone: string | null;
          currency: string;
          categories: string[];
          manager_id: string | null;
          manager_name: string | null;
          total_debt: number;
          overdue_amount: number;
          overdue_date: string | null;
          next_due_date: string | null;
          last_entry_at: string | null;
          entry_count: number;
        }[];
      };
      org_category_breakdown: {
        Args: {
          target_org_id: string;
          p_from?: string | null;
          p_to?: string | null;
          p_category?: string | null;
        };
        Returns: {
          category_name: string;
          unit: string | null;
          kind: 'kirim' | 'chiqim';
          total_quantity: number;
          total_amount: number;
          entry_count: number;
        }[];
      };
      org_overdue_by_counterparty: {
        Args: { target_org_id: string; p_as_of?: string | null; p_category?: string | null };
        Returns: {
          counterparty_id: string;
          counterparty_name: string;
          overdue_amount: number;
          overdue_date: string;
        }[];
      };
      org_due_soon: {
        Args: { target_org_id: string; p_within_days?: number | null; p_category?: string | null };
        Returns: {
          transaction_id: string;
          counterparty_name: string;
          description: string | null;
          amount: number;
          due_date: string;
        }[];
      };
      org_module_breakdown: {
        Args: { target_org_id: string; p_from?: string | null; p_to?: string | null };
        Returns: {
          module_name: string;
          counterparty_count: number;
          total_kirim: number;
          total_chiqim: number;
          balance: number;
        }[];
      };
      counterparty_ledger_page: {
        Args: {
          p_counterparty_id: string;
          p_limit?: number | null;
          p_before_occurred_at?: string | null;
          p_before_created_at?: string | null;
        };
        Returns: {
          id: string;
          document_no: string | null;
          occurred_at: string;
          created_at: string;
          due_date: string | null;
          description: string | null;
          quantity: number | null;
          unit: string | null;
          quantity_kg: number | null;
          quantity_dona: number | null;
          debit_account_type: 'receivable' | 'cash' | 'sales' | 'inventory' | 'other';
          debit_amount: number;
          credit_account_type: 'receivable' | 'cash' | 'sales' | 'inventory' | 'other';
          credit_amount: number;
          currency: string;
          source: 'fabrika' | 'shaxsiy';
          status: 'draft' | 'posted' | 'reversed' | 'reversal';
          reversal_of_id: string | null;
          reversed_by_id: string | null;
          category_name: string | null;
          running_balance: number;
          balance_side: 'debit' | 'credit';
        }[];
      };
      org_period_totals: {
        Args: { target_org_id: string; p_from?: string | null; p_to?: string | null };
        Returns: {
          total_kirim: number;
          total_chiqim: number;
          /** Movement on the receivable over the period, not revenue (0029). */
          net: number;
          /** The receivable position as of p_to — ignores p_from by design. */
          total_debt: number;
        }[];
      };
      reverse_transaction: {
        Args: {
          p_transaction_id: string;
          p_reversal_date?: string | null;
          p_reason?: string | null;
        };
        Returns: string;
      };
      post_transaction: {
        Args: { p_transaction_id: string };
        Returns: void;
      };
      generate_accounting_periods: {
        Args: { target_org_id: string; p_year: number };
        Returns: number;
      };
      close_accounting_period: {
        Args: { p_period_id: string };
        Returns: void;
      };
      reopen_accounting_period: {
        Args: { p_period_id: string };
        Returns: void;
      };
      // Sklad (0021-0023). sklad_batch_page and sklad_stock_by_item are
      // SECURITY INVOKER: the price columns come back null for staff because
      // sklad_batch_prices has no member SELECT policy, not because any code
      // blanks them.
      sklad_batch_page: {
        Args: {
          target_org_id: string;
          p_search?: string | null;
          p_product_type_id?: string | null;
          p_color_id?: string | null;
          p_pantone_id?: string | null;
          p_sort_id?: string | null;
          p_gsm?: number | null;
          p_width_cm?: number | null;
          p_length_cm?: number | null;
          p_order_id?: string | null;
          p_counterparty_id?: string | null;
          // text at the database boundary, enum-valued in practice.
          p_status?: SkladBatchStatusValue | null;
          p_from?: string | null;
          p_to?: string | null;
          p_in_stock_only?: boolean | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: {
          id: string;
          item_id: string;
          order_id: string | null;
          kod: string | null;
          item_name: string;
          product_type: string | null;
          yarn_type: string | null;
          width_cm: number | null;
          length_cm: number | null;
          sort_name: string | null;
          color_name: string | null;
          pantone_code: string | null;
          gsm: number | null;
          brutto_kg: number | null;
          netto_kg: number | null;
          tara_kg: number | null;
          piece_weight_kg: number | null;
          dona_soni: number | null;
          nabor_soni: number | null;
          qop_soni: number | null;
          qoldiq_dona: number | null;
          qoldiq_kg: number | null;
          ishlab_chiqarilgan_sana: string | null;
          omborga_kirgan_sana: string;
          status: SkladBatchStatusValue;
          order_no: string | null;
          order_name: string | null;
          counterparty_name: string | null;
          defect_type: string | null;
          defect_qty: number | null;
          notes: string | null;
          location_sector: string | null;
          location_row: string | null;
          location_rack: string | null;
          location_shelf: string | null;
          created_at: string;
          price_per_kg: number | null;
          price_per_piece: number | null;
          price_per_set: number | null;
          total_amount: number | null;
          purchase_cost: number | null;
          profit_percent: number | null;
          profit_amount: number | null;
          currency: string | null;
          total_count: number;
          sum_netto_kg: number | null;
          sum_qoldiq_dona: number | null;
          sum_qoldiq_kg: number | null;
          sum_total_amount: number | null;
          /** Null when the filtered set mixes currencies — the sum is then
           * not a figure anyone should be shown. */
          sum_currency: string | null;
        }[];
      };
      // Despatch (0026): the counterpart of sklad_receive_rows — one document,
      // several batches, one transaction, and the stock movements recorded
      // through the same rules as everywhere else.
      sklad_issue_rows: {
        Args: {
          target_org_id: string;
          p_rows: unknown;
          p_counterparty_id?: string | null;
          p_order_id?: string | null;
          p_manager_id?: string | null;
          p_document_no?: string | null;
          p_shipped_at?: string | null;
          p_note?: string | null;
          p_invoice_id?: string | null;
        };
        Returns: string;
      };
      sklad_issuable_batches: {
        Args: { target_org_id: string; p_search?: string | null; p_limit?: number | null };
        Returns: {
          batch_id: string;
          item_id: string;
          kod: string | null;
          item_name: string;
          product_type: string | null;
          width_cm: number | null;
          length_cm: number | null;
          color_name: string | null;
          sort_name: string | null;
          qoldiq_dona: number;
          piece_weight_kg: number | null;
          order_id: string | null;
          order_no: string | null;
          omborga_kirgan_sana: string;
        }[];
      };
      // Sales invoices (0027).
      sklad_create_invoice: {
        Args: {
          target_org_id: string;
          p_counterparty_id: string;
          p_rows: unknown;
          p_order_id?: string | null;
          p_manager_id?: string | null;
          p_issued_at?: string | null;
          p_due_date?: string | null;
          p_currency?: string | null;
          p_note?: string | null;
        };
        Returns: string;
      };
      sklad_invoice_by_code: {
        Args: { target_org_id: string; p_code: string };
        Returns: {
          invoice_id: string;
          invoice_no: string | null;
          barcode: string | null;
          status: SkladInvoiceStatusValue;
          issued_at: string;
          counterparty_id: string | null;
          counterparty_name: string;
          order_id: string | null;
          manager_id: string | null;
          currency: string;
          note: string | null;
          line_id: string | null;
          item_id: string | null;
          batch_id: string | null;
          kod: string | null;
          item_name: string | null;
          width_cm: number | null;
          length_cm: number | null;
          color_name: string | null;
          ordered_dona: number | null;
          shipped_dona: number | null;
          remaining_dona: number | null;
          batch_qoldiq_dona: number | null;
          unit_price: number | null;
          amount: number | null;
        }[];
      };
      sklad_invoice_page: {
        Args: {
          target_org_id: string;
          p_status?: SkladInvoiceStatusValue | null;
          p_counterparty_id?: string | null;
          p_search?: string | null;
          p_limit?: number | null;
        };
        Returns: {
          invoice_id: string;
          invoice_no: string | null;
          barcode: string | null;
          status: SkladInvoiceStatusValue;
          issued_at: string;
          due_date: string | null;
          counterparty_id: string | null;
          counterparty_name: string;
          manager_name: string | null;
          order_no: string | null;
          currency: string;
          line_count: number;
          ordered_dona: number;
          shipped_dona: number;
          total_amount: number | null;
        }[];
      };
      sklad_shipment_note: {
        Args: { p_shipment_id: string };
        Returns: {
          shipment_id: string;
          document_no: string | null;
          shipped_at: string;
          counterparty_name: string | null;
          manager_name: string | null;
          order_no: string | null;
          invoice_id: string | null;
          invoice_no: string | null;
          invoice_barcode: string | null;
          note: string | null;
          line_id: string | null;
          kod: string | null;
          item_name: string | null;
          width_cm: number | null;
          length_cm: number | null;
          color_name: string | null;
          dona: number | null;
          kg: number | null;
        }[];
      };
      record_sklad_movement: {
        Args: {
          p_batch_id: string;
          p_kind: 'kirim' | 'chiqim' | 'qaytarish' | 'brak' | 'korrektirovka';
          p_dona: number;
          p_kg?: number | null;
          p_occurred_at?: string | null;
          p_counterparty_id?: string | null;
          p_order_id?: string | null;
          p_note?: string | null;
        };
        Returns: string;
      };
      list_sklad_movements: {
        Args: { p_batch_id: string; p_limit?: number | null };
        Returns: {
          id: string;
          kind: 'kirim' | 'chiqim' | 'qaytarish' | 'brak' | 'korrektirovka';
          dona: number;
          kg: number | null;
          occurred_at: string;
          counterparty_name: string | null;
          order_no: string | null;
          note: string | null;
          is_initial: boolean;
          created_by_name: string | null;
          created_at: string;
        }[];
      };
      // Production chain (0024-0025).
      sklad_receive_rows: {
        Args: {
          target_org_id: string;
          p_rows: unknown;
          p_order_id?: string | null;
          p_received_at?: string | null;
        };
        Returns: number;
      };
      sklad_order_progress: {
        Args: { p_order_id: string };
        Returns: {
          line_id: string;
          line_position: number;
          description: string | null;
          item_name: string | null;
          kod: string | null;
          size_text: string | null;
          color_text: string | null;
          planned_dona: number | null;
          planned_kg: number | null;
          ready_dona: number;
          defect_dona: number;
          shipped_dona: number;
          shipped_kg: number;
          remaining_dona: number;
        }[];
      };
      sklad_order_stage_matrix: {
        Args: { p_order_id: string };
        Returns: {
          line_id: string;
          stage_id: string;
          stage_name: string;
          stage_position: number;
          is_final: boolean;
          qty_in: number | null;
          qty_out: number | null;
          defect_qty: number | null;
          kg: number | null;
          entry_count: number;
          last_occurred_at: string | null;
        }[];
      };
      sklad_order_clients: {
        Args: { p_order_id: string };
        Returns: {
          counterparty_id: string | null;
          counterparty_name: string;
          shipment_count: number;
          shipped_dona: number;
          shipped_kg: number;
          last_shipped_at: string | null;
        }[];
      };
      sklad_order_summary: {
        Args: {
          target_org_id: string;
          p_status?: SkladOrderStatusValue | null;
          p_counterparty_id?: string | null;
          p_manager_id?: string | null;
          p_limit?: number | null;
        };
        Returns: {
          order_id: string;
          order_no: string | null;
          order_name: string | null;
          status: SkladOrderStatusValue;
          deadline: string | null;
          counterparty_id: string | null;
          counterparty_name: string | null;
          manager_name: string | null;
          line_count: number;
          planned_dona: number;
          ready_dona: number;
          shipped_dona: number;
          remaining_dona: number;
          current_stage: string | null;
          created_at: string;
        }[];
      };
      sklad_stage_load: {
        Args: { target_org_id: string; p_from?: string | null; p_to?: string | null };
        Returns: {
          stage_id: string;
          stage_name: string;
          stage_position: number;
          entry_count: number;
          qty_out: number;
          defect_qty: number;
          kg: number;
        }[];
      };
      list_sklad_stage_entries: {
        Args: { p_order_line_id: string; p_stage_id: string };
        Returns: {
          id: string;
          qty_in: number | null;
          qty_out: number | null;
          defect_qty: number | null;
          kg: number | null;
          executor_name: string | null;
          occurred_at: string;
          note: string | null;
          created_by_name: string | null;
          created_at: string;
        }[];
      };
      list_sklad_audit: {
        Args: { target_org_id: string; p_limit?: number | null };
        Returns: {
          id: number;
          entity:
            'batch' | 'item' | 'price' | 'order' | 'line' | 'stage_entry' | 'shipment' | 'invoice';
          entity_id: string;
          action: 'insert' | 'update' | 'delete';
          changed_at: string;
          changed_by_name: string | null;
          item_name: string | null;
          kod: string | null;
          old_row: Record<string, unknown> | null;
          new_row: Record<string, unknown> | null;
        }[];
      };
      sklad_stock_by_item: {
        Args: { target_org_id: string };
        Returns: {
          item_id: string;
          kod: string | null;
          item_name: string;
          product_type: string | null;
          width_cm: number | null;
          length_cm: number | null;
          color_name: string | null;
          batch_count: number;
          total_dona: number;
          total_kg: number;
          stock_value: number | null;
        }[];
      };
      list_accounting_periods: {
        Args: { target_org_id: string; p_year?: number | null };
        Returns: {
          id: string;
          name: string;
          start_date: string;
          end_date: string;
          status: 'open' | 'closed';
          closed_at: string | null;
          closed_by_name: string | null;
          entry_count: number;
          draft_count: number;
          total_kirim: number;
          total_chiqim: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
