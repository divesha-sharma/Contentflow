-- =========================================================
-- CONTENTFLOW — SUPABASE SCHEMA
-- Run this whole file once in your Supabase project's
-- SQL Editor (Dashboard → SQL Editor → New query → Run).
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- PROJECTS ----------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

-- ---------- TASKS (calendar items) ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete cascade,
  content_type text not null,
  stage text not null,
  date date not null,
  time text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- IDEAS ----------
create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  project_id uuid references projects(id) on delete cascade,
  content_type text not null,
  tags text[] not null default '{}',
  date_added date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- PEOPLE ----------
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- ASSIGNED TASKS ----------
create table if not exists assigned_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  person_id uuid references people(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  deadline date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- helpful indexes
create index if not exists idx_tasks_date on tasks(date);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_ideas_project on ideas(project_id);
create index if not exists idx_people_project on people(project_id);
create index if not exists idx_assigned_tasks_person on assigned_tasks(person_id);

-- =========================================================
-- ROW LEVEL SECURITY
-- This app has no login screen — it uses Supabase's public
-- "anon" publishable key straight from the browser. That
-- means anyone with your URL + key can read/write this data
-- unless you lock it down with real auth later.
--
-- The policies below simply allow full read/write access to
-- everyone, which matches how the app behaves today. If you
-- add user accounts later, replace these with policies scoped
-- to auth.uid().
-- =========================================================

alter table projects enable row level security;
alter table tasks enable row level security;
alter table ideas enable row level security;
alter table people enable row level security;
alter table assigned_tasks enable row level security;

drop policy if exists "public full access" on projects;
create policy "public full access" on projects for all using (true) with check (true);

drop policy if exists "public full access" on tasks;
create policy "public full access" on tasks for all using (true) with check (true);

drop policy if exists "public full access" on ideas;
create policy "public full access" on ideas for all using (true) with check (true);

drop policy if exists "public full access" on people;
create policy "public full access" on people for all using (true) with check (true);

drop policy if exists "public full access" on assigned_tasks;
create policy "public full access" on assigned_tasks for all using (true) with check (true);
