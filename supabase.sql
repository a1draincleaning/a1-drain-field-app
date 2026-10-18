-- A-1 Drain Cleaning Field App
-- Run this entire file in the Supabase SQL Editor.
-- Never put the database password or service_role key into the web app.

create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cust_name text not null check (char_length(cust_name) between 1 and 160),
  cust_phone text not null default '',
  service_addr text not null check (char_length(service_addr) between 1 and 300),
  invoice_num text not null default '',
  work_desc text not null default '',
  exist_notes text,
  signer_name text,
  signature_data text,
  sign_time timestamptz,
  timezone text,
  agreement_version text,
  is_signed boolean not null default false,
  invoice_photo text,
  job_photos jsonb not null default '[]'::jsonb,
  comp_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs enable row level security;

drop policy if exists "Users can view own jobs" on public.jobs;
drop policy if exists "Users can insert own jobs" on public.jobs;
drop policy if exists "Users can update own jobs" on public.jobs;
drop policy if exists "Users can delete own jobs" on public.jobs;

create policy "Users can view own jobs" on public.jobs for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own jobs" on public.jobs for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own jobs" on public.jobs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own jobs" on public.jobs for delete to authenticated using (auth.uid() = user_id);

create or replace function public.set_jobs_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists jobs_updated_at on public.jobs;
create trigger jobs_updated_at before update on public.jobs for each row execute function public.set_jobs_updated_at();

insert into storage.buckets (id, name, public) values ('job-photos', 'job-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can upload own job photos" on storage.objects;
drop policy if exists "Users can read own job photos" on storage.objects;
drop policy if exists "Users can delete own job photos" on storage.objects;

create policy "Users can upload own job photos" on storage.objects for insert to authenticated with check (
  bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "Users can read own job photos" on storage.objects for select to authenticated using (
  bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "Users can delete own job photos" on storage.objects for delete to authenticated using (
  bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create index if not exists jobs_user_updated_idx on public.jobs(user_id, updated_at desc);
create index if not exists jobs_user_invoice_idx on public.jobs(user_id, invoice_num);
