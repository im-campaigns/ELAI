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

-- AI쌤 온보딩 + 개인화: 가입 직후 1:1교육 대화로 파악하는 프로필 정보.
alter table users add column if not exists job text;
alter table users add column if not exists ai_interest text
  check (ai_interest is null or ai_interest in ('업무활용', '공부', '창작', '기타'));
alter table users add column if not exists ai_level text
  check (ai_level is null or ai_level in ('beginner', 'intermediate', 'advanced'));
alter table users add column if not exists onboarding_done boolean not null default false;

-- 이 마이그레이션 실행 시점에 이미 존재하던 회원은 온보딩 대화를 강제로 띄우지 않도록 완료 처리한다.
-- (이후 새로 가입하는 회원은 onboarding_done 기본값 false를 그대로 받는다)
update users set onboarding_done = true where onboarding_done = false;
