/**
 * Hand-written stand-in for the Supabase-generated types.
 * Replace by running `npm run types:generate` in packages/database once a
 * local or hosted Supabase project is available (see packages/database/package.json).
 *
 * `Relationships: []` on every table and the empty Views/Functions/Enums/
 * CompositeTypes are required for @supabase/supabase-js's generic client to
 * infer row types correctly — without them every query resolves to `never`.
 */
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
          kind: 'mahsulot_turi' | 'ip_turi' | 'olcham' | 'sort' | 'rang' | 'pantone';
          name: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sklad_lookups']['Row']> & {
          org_id: string;
          kind: 'mahsulot_turi' | 'ip_turi' | 'olcham' | 'sort' | 'rang' | 'pantone';
          name: string;
        };
        Update: Partial<Database['public']['Tables']['sklad_lookups']['Row']>;
        Relationships: [];
      };
      sklad_items: {
        Row: {
          id: string;
          org_id: string;
          artikul: string | null;
          kod: string | null;
          name: string;
          product_type_id: string | null;
          yarn_type_id: string | null;
          gsm: number | null;
          size_id: string | null;
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
          pallet_soni: number | null;
          piece_weight_kg: number | null;
          qoldiq_dona: number | null;
          ishlab_chiqarilgan_sana: string | null;
          omborga_kirgan_sana: string;
          status:
            'tayyor' | 'qadoqlanmoqda' | 'omborda' | 'rezerv' | 'jonatildi' | 'qaytarildi' | 'brak';
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
        Returns: { total_kirim: number; total_chiqim: number; net: number }[];
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
