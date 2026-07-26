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
      list_org_roster: {
        Args: { target_org_id: string };
        Returns: {
          user_id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
