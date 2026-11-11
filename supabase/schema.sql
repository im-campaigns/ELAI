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
  check (ai_interest is null or ai_interest in ('업무활용', '공부', '창작', '자유주제'));
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
  interest text not null check (interest in ('업무활용', '공부', '창작', '자유주제')),
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

-- 기본 방 예시 데이터: 수준(입문/중급/고급) x 관심분야(업무활용/공부/창작/자유주제) 조합.
-- 이름이 이미 있으면 다시 넣지 않아 여러 번 실행해도 안전하다.
insert into study_rooms (name, description, level, interest, max_members)
select v.name, v.description, v.level, v.interest, 6
from (
  values
    ('칼퇴 첫걸음: 챗GPT로 이메일 5분 끝내기', '매일 쓰는 이메일·메모 작성을 AI로 빠르게 끝내는 법부터 배워요.', 'beginner', '업무활용'),
    ('AI 첫걸음: 챗GPT랑 친해지는 30분', 'AI가 뭔지, 어떻게 질문해야 잘 답해주는지부터 차근차근 알아가요.', 'beginner', '공부'),
    ('AI로 내 첫 그림책 만들기', '글과 그림을 AI로 뽑아보며 나만의 짧은 이야기를 완성해봐요.', 'beginner', '창작'),
    ('뭐든 물어보는 AI 체험반', '주제 안 가리고 평소 궁금했던 걸 AI한테 마음껏 물어보는 시간이에요.', 'beginner', '자유주제'),
    ('칼퇴 프로젝트: 보고서·엑셀 AI로 끝내기', '보고서 초안, 엑셀 정리처럼 시간 잡아먹는 업무를 AI로 줄여봐요.', 'intermediate', '업무활용'),
    ('AI 개념 한 단계 업그레이드', '프롬프트 작성법과 AI 작동 원리를 더 깊이 이해해봐요.', 'intermediate', '공부'),
    ('AI 작가 되기: 내 스토리에 살 붙이기', '짧은 아이디어를 AI와 함께 완성도 있는 글·이미지로 키워봐요.', 'intermediate', '창작'),
    ('AI로 내 일상 업그레이드하기', '일정 관리, 정보 검색 등 일상 곳곳에 AI를 제대로 써먹어봐요.', 'intermediate', '자유주제'),
    ('회사 AI 전략가 되기', '업무 자동화를 설계하고 팀에 AI 활용법을 전파하는 수준까지 올라가요.', 'advanced', '업무활용'),
    ('AI 전문가 코스', '최신 AI 모델과 트렌드를 깊이 파고들어 전문가 수준으로 공부해요.', 'advanced', '공부'),
    ('나만의 AI 창작 스튜디오 만들기', '여러 AI 도구를 조합해 완성도 높은 창작 결과물을 만들어봐요.', 'advanced', '창작'),
    ('나만의 AI 비서 직접 만들어보기', '자동화·연동까지 다뤄보며 나만 쓰는 AI 비서를 직접 설계해봐요.', 'advanced', '자유주제')
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

-- AI쌤 환영 인사를 방당 정확히 한 번만 저장하기 위한 구분값.
-- 'welcome' 값을 가진 행은 room_id마다 하나만 존재할 수 있도록 아래 유니크 인덱스로 강제한다.
alter table room_messages add column if not exists kind text;
create unique index if not exists room_messages_welcome_once_idx
  on room_messages (room_id)
  where kind = 'welcome';

alter table room_messages enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.

-- 그룹과외 3-3단계: 가상 AI 학생
-- 여러 번 실행해도 안전하도록 if not exists / drop-then-add 패턴을 사용한다.
-- 이 내용은 supabase/schema.sql 맨 아래에도 동일하게 포함되어 있다.

-- ========== 1) ai_students 테이블 ==========
create table if not exists ai_students (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references study_rooms(id) on delete cascade,
  nickname text not null unique,
  persona jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ai_students_room_id_idx on ai_students (room_id);

alter table ai_students enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.

-- ========== 2) room_messages 확장: AI 학생 발신자 구분 + 표시 지연(visible_at) ==========
alter table room_messages add column if not exists ai_student_id uuid references ai_students(id) on delete set null;
alter table room_messages add column if not exists triggered_by uuid references room_messages(id) on delete set null;

-- 메시지는 생성 즉시 보이지 않고 visible_at 시각이 되어야 보인다(사람처럼 시간차를 두는 효과).
-- 기존 메시지는 visible_at = created_at으로 채워서 즉시 보이던 것과 동일하게 유지한다.
alter table room_messages add column if not exists visible_at timestamptz;
update room_messages set visible_at = created_at where visible_at is null;
alter table room_messages alter column visible_at set default now();
alter table room_messages alter column visible_at set not null;

create index if not exists room_messages_room_id_visible_at_idx on room_messages (room_id, visible_at);

-- sender_type에 'ai_student'를 허용하도록 체크 제약을 다시 만든다.
alter table room_messages drop constraint if exists room_messages_sender_type_check;
alter table room_messages add constraint room_messages_sender_type_check
  check (sender_type in ('member', 'ai_teacher', 'ai_student'));

-- 비용 보호: 회원 메시지 1개(triggered_by)당 AI 학생 응답은 최대 1개만 허용한다.
-- (동시 요청으로 중복 생성되더라도 DB 유니크 제약이 하나만 통과시킨다)
create unique index if not exists room_messages_ai_student_trigger_once_idx
  on room_messages (triggered_by)
  where sender_type = 'ai_student' and triggered_by is not null;

-- ========== 3) 기존 12개 방에 AI 학생 자동 생성 ==========
-- 방마다 1~3명, 닉네임은 전부 겹치지 않게 미리 만들어둔다.
-- 닉네임이 이미 있으면(재실행) 다시 넣지 않아 여러 번 실행해도 안전하다.
insert into ai_students (room_id, nickname, persona)
select sr.id, v.nickname, v.persona::jsonb
from (
  values
    ('칼퇴 첫걸음: 챗GPT로 이메일 5분 끝내기', '엑셀장인되고싶다', '{"ageGroup":"40대","job":"사무직","motivation":"보고서 쓰는 시간을 줄이고 싶어서","aiLevel":"입문","personality":"질문이 많은 편","role":"질문형","speechStyle":"존댓말, 짧은 문장, 가끔 ㅎㅎ 사용","replyChance":0.4,"typoChance":0.05}'),
    ('칼퇴 첫걸음: 챗GPT로 이메일 5분 끝내기', '보고서킬러', '{"ageGroup":"30대","job":"사무직 과장","motivation":"회사에서 AI 쓰라고 해서 얼떨결에 시작","aiLevel":"입문","personality":"가끔 엉뚱한 말을 하는 편","role":"엉뚱형","speechStyle":"반말과 존댓말이 섞인 편하고 ㅋㅋ를 자주 씀","replyChance":0.3,"typoChance":0.1}'),

    ('AI 첫걸음: 챗GPT랑 친해지는 30분', '코딩독학중', '{"ageGroup":"20대","job":"취업 준비생","motivation":"비전공자라서 AI 기초부터 제대로 배우고 싶어서","aiLevel":"입문","personality":"질문이 많은 편","role":"질문형","speechStyle":"존댓말, 짧은 문장 위주","replyChance":0.45,"typoChance":0.05}'),
    ('AI 첫걸음: 챗GPT랑 친해지는 30분', '자소서준비생', '{"ageGroup":"20대","job":"취업 준비생","motivation":"자소서와 면접에 AI 활용 경험을 넣으려고","aiLevel":"입문","personality":"공감을 잘하는 편","role":"공감형","speechStyle":"친근한 반말체, ㅎㅎ를 자주 씀","replyChance":0.35,"typoChance":0.08}'),
    ('AI 첫걸음: 챗GPT랑 친해지는 30분', '육아맘도전기', '{"ageGroup":"30대","job":"육아 중","motivation":"아이 재우고 짬짬이 AI 공부를 시작","aiLevel":"입문","personality":"조용한 편","role":"조용형","speechStyle":"짧은 존댓말","replyChance":0.15,"typoChance":0.05}'),

    ('AI로 내 첫 그림책 만들기', '대학생창작러', '{"ageGroup":"20대","job":"대학생","motivation":"블로그와 영상 글감을 AI로 뽑아보고 싶어서","aiLevel":"입문","personality":"질문이 많은 편","role":"질문형","speechStyle":"반말 섞인 친근체, ㅋㅋ를 자주 씀","replyChance":0.4,"typoChance":0.1}'),
    ('AI로 내 첫 그림책 만들기', '블로그글감헌터', '{"ageGroup":"30대","job":"프리랜서 작가 지망","motivation":"매번 소재 고민하다 AI로 도움을 받으려고","aiLevel":"입문","personality":"공감을 잘하는 편","role":"공감형","speechStyle":"존댓말과 이모티콘을 함께 씀","replyChance":0.3,"typoChance":0.03}'),

    ('뭐든 물어보는 AI 체험반', '카페알바생', '{"ageGroup":"20대","job":"카페 알바","motivation":"그냥 재미로 AI를 써보고 싶어서","aiLevel":"입문","personality":"조용한 편","role":"조용형","speechStyle":"짧은 반말체","replyChance":0.2,"typoChance":0.1}'),

    ('칼퇴 프로젝트: 보고서·엑셀 AI로 끝내기', '초보마케터J', '{"ageGroup":"20대","job":"마케터","motivation":"업무 보고서와 카피 작성에 AI를 적극 활용하는 중","aiLevel":"중급","personality":"질문이 많은 편","role":"질문형","speechStyle":"깔끔한 존댓말","replyChance":0.35,"typoChance":0.03}'),
    ('칼퇴 프로젝트: 보고서·엑셀 AI로 끝내기', '야근러버는아님', '{"ageGroup":"30대","job":"기획자","motivation":"야근을 줄이려고 업무 자동화를 배우는 중","aiLevel":"중급","personality":"가끔 엉뚱한 말을 하는 편","role":"엉뚱형","speechStyle":"반말 섞인 유머러스한 말투, ㅋㅋ를 자주 씀","replyChance":0.3,"typoChance":0.08}'),

    ('AI 개념 한 단계 업그레이드', '데이터분석초보', '{"ageGroup":"30대","job":"직장인","motivation":"데이터 분석에 AI 도구를 더 깊이 쓰고 싶어서","aiLevel":"중급","personality":"질문이 많은 편","role":"질문형","speechStyle":"차분한 존댓말","replyChance":0.35,"typoChance":0.03}'),
    ('AI 개념 한 단계 업그레이드', '프롬프트초보', '{"ageGroup":"20대","job":"대학원생","motivation":"논문 작업에 AI 프롬프트를 제대로 써보고 싶어서","aiLevel":"중급","personality":"공감을 잘하는 편","role":"공감형","speechStyle":"친근한 반말체, ㅎㅎ를 자주 씀","replyChance":0.3,"typoChance":0.05}'),

    ('AI 작가 되기: 내 스토리에 살 붙이기', '디자이너꿈나무', '{"ageGroup":"20대","job":"디자인 전공생","motivation":"AI 이미지 생성 실력을 더 키우고 싶어서","aiLevel":"중급","personality":"질문이 많은 편","role":"질문형","speechStyle":"존댓말과 이모티콘을 함께 씀","replyChance":0.4,"typoChance":0.03}'),
    ('AI 작가 되기: 내 스토리에 살 붙이기', '소설쓰는직장인', '{"ageGroup":"30대","job":"회사원","motivation":"퇴근 후 취미로 AI와 함께 소설을 쓰는 중","aiLevel":"중급","personality":"공감을 잘하는 편","role":"공감형","speechStyle":"차분하고 긴 문장의 존댓말","replyChance":0.3,"typoChance":0.02}'),
    ('AI 작가 되기: 내 스토리에 살 붙이기', '글쓰기좋아하는사람', '{"ageGroup":"40대","job":"주부","motivation":"블로그 글을 AI와 같이 다듬는 중","aiLevel":"중급","personality":"조용한 편","role":"조용형","speechStyle":"짧은 존댓말","replyChance":0.15,"typoChance":0.05}'),

    ('AI로 내 일상 업그레이드하기', '취준생다이어리', '{"ageGroup":"20대","job":"취업 준비생","motivation":"이것저것 AI로 다 해보는 중","aiLevel":"중급","personality":"가끔 엉뚱한 말을 하는 편","role":"엉뚱형","speechStyle":"반말체, ㅋㅋ를 자주 씀","replyChance":0.25,"typoChance":0.1}'),

    ('회사 AI 전략가 되기', '스타트업대표님', '{"ageGroup":"30대","job":"스타트업 대표","motivation":"회사 업무 전반에 AI를 전략적으로 도입하려고","aiLevel":"고급","personality":"질문이 많은 편","role":"질문형","speechStyle":"간결한 존댓말","replyChance":0.3,"typoChance":0.02}'),
    ('회사 AI 전략가 되기', '마케팅짬밥10년', '{"ageGroup":"40대","job":"마케팅 팀장","motivation":"팀에 AI 활용법을 전파하려고 깊이 공부 중","aiLevel":"고급","personality":"공감을 잘하는 편","role":"공감형","speechStyle":"존댓말, 가끔 ㅎㅎ를 씀","replyChance":0.3,"typoChance":0.03}'),

    ('AI 전문가 코스', '개발자이직준비', '{"ageGroup":"30대","job":"개발자","motivation":"AI 엔지니어로 이직을 준비하는 중","aiLevel":"고급","personality":"질문이 많은 편","role":"질문형","speechStyle":"간결한 존댓말","replyChance":0.3,"typoChance":0.02}'),

    ('나만의 AI 창작 스튜디오 만들기', '프리랜서그림쟁이', '{"ageGroup":"30대","job":"프리랜서 일러스트레이터","motivation":"AI 툴로 작업 효율을 극대화하려고","aiLevel":"고급","personality":"질문이 많은 편","role":"질문형","speechStyle":"존댓말, 가끔 이모티콘을 씀","replyChance":0.3,"typoChance":0.03}'),
    ('나만의 AI 창작 스튜디오 만들기', '은퇴후새출발', '{"ageGroup":"50대","job":"은퇴 후 글쓰기 시작","motivation":"인생 2막으로 AI 창작 활동을 준비하는 중","aiLevel":"고급","personality":"공감을 잘하는 편","role":"공감형","speechStyle":"정중하고 느린 호흡의 존댓말","replyChance":0.25,"typoChance":0.02}'),

    ('나만의 AI 비서 직접 만들어보기', '조용히듣는사람', '{"ageGroup":"40대","job":"직장인","motivation":"여러 분야에 AI를 써보며 주로 듣기만 하는 중","aiLevel":"고급","personality":"조용한 편","role":"조용형","speechStyle":"짧은 존댓말","replyChance":0.12,"typoChance":0.0}')
) as v(room_name, nickname, persona)
join study_rooms sr on sr.name = v.room_name
where not exists (select 1 from ai_students x where x.nickname = v.nickname);
