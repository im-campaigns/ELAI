-- 그룹과외 3-4단계: 관리자 대시보드용 테이블/컬럼
-- 여러 번 실행해도 안전하다(if not exists).

-- ========== 1) 회원 최근 접속 시각 ==========
-- 로그인할 때마다 갱신되며, 대시보드의 "최근 접속일" 집계에 쓰인다.
alter table users add column if not exists last_login_at timestamptz;

-- ========== 2) 안전 필터 차단 기록 ==========
-- AI 출력이 안전 규칙(전화번호/링크/SNS 유도 등)에 걸려 대체 문구로 바뀔 때마다 한 줄 남긴다.
-- 차단된 문장 원문은 저장하지 않고, 어떤 종류였는지(reason)만 기록한다.
create table if not exists ai_safety_log (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references study_rooms(id) on delete set null,
  purpose text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_safety_log_created_at_idx on ai_safety_log (created_at desc);

alter table ai_safety_log enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.

-- ========== 3) 관리자 설정값 (모델 단가 등) ==========
-- 관리자 대시보드에서 직접 입력하는 값. 예상 비용 계산에만 쓰이며 실제 청구액과는 다를 수 있다.
create table if not exists admin_settings (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);

alter table admin_settings enable row level security;
-- 다른 테이블과 동일하게 정책은 만들지 않는다: service_role 키로만 서버에서 접근한다.
