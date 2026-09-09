-- ELAI Supabase schema
-- Run this once in the Supabase SQL editor (https://app.supabase.com/project/_/sql) for your project.
-- RLS is enabled with NO public policies: only the server-side service role key (never exposed
-- to the browser) can read/write these tables. The app never talks to Supabase from the client.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  nickname text unique not null,
  password_hash text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_id_created_at_idx on chat_messages (user_id, created_at);

create table if not exists curriculum_progress (
  user_id uuid not null references users(id) on delete cascade,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  subtopic_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, level, subtopic_id)
);

alter table users enable row level security;
alter table chat_messages enable row level security;
alter table curriculum_progress enable row level security;
-- No policies are defined on purpose: the anon/authenticated roles get zero access.
-- All access happens through the server using the service_role key, which bypasses RLS.
