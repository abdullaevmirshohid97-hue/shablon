-- Minimal Supabase-shaped scaffolding so the real migrations can run against
-- a plain Postgres container: the auth/storage schemas, auth.uid(), and the
-- realtime publication they reference. Test-only.

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create extension if not exists pgcrypto;

create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text,
  phone text
);

create table auth.identities (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  provider_id text,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

-- Swapped per-test with `set app.current_user_id = '<uuid>'` to impersonate.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

create function auth.role() returns text language sql stable as $$
  select 'authenticated'::text;
$$;

create table storage.buckets (
  id text primary key,
  name text,
  public boolean default false
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
alter table storage.objects enable row level security;

create publication supabase_realtime;

-- A non-superuser so RLS is actually enforced (owners/superusers bypass it).
create role app_user login password 'test';
grant usage on schema public, auth, storage, extensions to app_user;
