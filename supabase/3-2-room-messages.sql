-- 그룹과외 3-2단계: 방 안의 대화 (room_messages)
-- 여러 번 실행해도 안전하도록 if not exists를 사용한다.
-- 이 내용은 supabase/schema.sql 맨 아래에도 동일하게 포함되어 있다.

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

-- AI쌤 환영 인사를 방당 정확히 한 번만 저장하기 위한 구분값.
-- 'welcome' 값을 가진 행은 room_id마다 하나만 존재할 수 있도록 아래 유니크 인덱스로 강제한다.
alter table room_messages add column if not exists kind text;
create unique index if not exists room_messages_welcome_once_idx
  on room_messages (room_id)
  where kind = 'welcome';

alter table room_messages enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.
