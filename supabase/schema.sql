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

-- 그룹과외 3-1단계: 방 목록 + 입장 승인
-- (채팅/AI쌤 진행/가상 AI 학생은 다음 단계에서 추가될 예정)
create table if not exists study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  interest text not null check (interest in ('업무활용', '공부', '창작', '기타')),
  max_members integer not null default 6,
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  room_id uuid not null references study_rooms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (room_id, user_id)
);
create index if not exists room_members_user_id_idx on room_members (user_id);

alter table study_rooms enable row level security;
alter table room_members enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.

-- 기본 방 예시 데이터: 수준(입문/중급/고급) x 관심분야(업무활용/공부/창작/기타) 조합.
-- 이름이 이미 있으면 다시 넣지 않아 여러 번 실행해도 안전하다.
insert into study_rooms (name, description, level, interest, max_members)
select v.name, v.description, v.level, v.interest, 6
from (
  values
    ('AI 업무활용 입문반', '업무에 AI를 처음 활용해보는 분들을 위한 모임이에요.', 'beginner', '업무활용'),
    ('AI 공부 입문반', 'AI 기초 개념을 함께 공부하는 모임이에요.', 'beginner', '공부'),
    ('AI 창작 입문반', 'AI로 글, 이미지 등 창작을 시작하는 모임이에요.', 'beginner', '창작'),
    ('AI 기타 입문반', '다양한 목적으로 AI를 처음 써보는 분들의 모임이에요.', 'beginner', '기타'),
    ('AI 업무활용 중급반', '업무에 AI를 적극적으로 활용 중인 분들의 모임이에요.', 'intermediate', '업무활용'),
    ('AI 공부 중급반', 'AI를 더 깊이 공부하고 싶은 분들의 모임이에요.', 'intermediate', '공부'),
    ('AI 창작 중급반', 'AI 창작 실력을 키우고 싶은 분들의 모임이에요.', 'intermediate', '창작'),
    ('AI 기타 중급반', 'AI 활용을 한 단계 더 발전시키는 모임이에요.', 'intermediate', '기타'),
    ('AI 업무활용 고급반', '업무 AI 활용을 고도화하는 분들의 모임이에요.', 'advanced', '업무활용'),
    ('AI 공부 고급반', 'AI를 전문적으로 공부하는 분들의 모임이에요.', 'advanced', '공부'),
    ('AI 창작 고급반', 'AI 창작을 전문적으로 다루는 분들의 모임이에요.', 'advanced', '창작'),
    ('AI 기타 고급반', 'AI를 깊이 활용하는 분들을 위한 고급 모임이에요.', 'advanced', '기타')
) as v(name, description, level, interest)
where not exists (select 1 from study_rooms sr where sr.name = v.name);

-- 그룹과외 3-2단계: 방 안의 대화 (room_messages)
create table if not exists room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references study_rooms(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  sender_type text not null check (sender_type in ('member', 'ai_teacher')),
  nickname text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists room_messages_room_id_created_at_idx on room_messages (room_id, created_at);

alter table room_messages enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.
