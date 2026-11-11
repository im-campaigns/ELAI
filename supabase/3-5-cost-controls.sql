-- 토큰 비용 절감을 위한 테이블: 대화 요약 캐시 + 토큰 사용량 로그
-- 여러 번 실행해도 안전하다(if not exists).

-- ========== 1) 방별 대화 요약 ==========
-- 방의 오래된 대화를 3~5문장으로 요약해 캐시해둔다. message_count_at_summary는
-- "이 요약이 몇 번째 메시지까지 반영했는지"를 뜻하며, 이후 메시지가 30개 이상
-- 더 쌓이면(현재 메시지 수 - message_count_at_summary >= 30) 요약을 다시 만든다.
create table if not exists room_conversation_summaries (
  room_id uuid primary key references study_rooms(id) on delete cascade,
  summary text not null default '',
  message_count_at_summary integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table room_conversation_summaries enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.

-- ========== 2) 토큰 사용량 로그 ==========
-- AI쌤/AI 학생/요약 호출마다 Anthropic 응답의 input/output 토큰 수를 기록해
-- 나중에 관리자 대시보드(3-4 admin)에서 방별·날짜별 비용을 집계할 수 있게 한다.
create table if not exists ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references study_rooms(id) on delete cascade,
  usage_date date not null default current_date,
  purpose text not null check (purpose in ('ai_teacher_reply', 'ai_student_reply', 'welcome', 'clarification', 'summary')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_log_room_date_idx on ai_usage_log (room_id, usage_date);

alter table ai_usage_log enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.
