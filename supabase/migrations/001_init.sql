-- SizeSeize initial schema: profiles + monitored_products + RLS

create extension if not exists "pgcrypto";

-- Profiles (synced from auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Monitored products
create table if not exists public.monitored_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_url text not null,
  product_name text,
  product_image_url text,
  desired_size text not null,
  last_known_available_sizes text[] not null default '{}',
  desired_size_available boolean not null default false,
  last_checked_at timestamptz,
  last_notification_sent_at timestamptz,
  last_check_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monitored_products_user_id_idx
  on public.monitored_products (user_id);

alter table public.monitored_products enable row level security;

create policy "Users can view own products"
  on public.monitored_products for select
  using (auth.uid() = user_id);

create policy "Users can insert own products"
  on public.monitored_products for insert
  with check (auth.uid() = user_id);

create policy "Users can update own products"
  on public.monitored_products for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own products"
  on public.monitored_products for delete
  using (auth.uid() = user_id);

-- Keep profiles in sync when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monitored_products_set_updated_at on public.monitored_products;
create trigger monitored_products_set_updated_at
  before update on public.monitored_products
  for each row execute function public.set_updated_at();
