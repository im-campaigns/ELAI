-- 그룹과외 방에 이미 쌓인 "AI쌤" 중복 메시지 정리
-- (환영 인사 중복 + AI쌤이 연달아 올린 반복 메시지)
--
-- 규칙: 같은 방에서 회원 메시지 없이 AI쌤 메시지가 연속으로 이어진 "묶음(run)" 하나당
--       가장 먼저 올라온 메시지 1개만 남기고 나머지를 지운다.
--       - 방 맨 처음에 중복으로 쌓인 환영 인사도 이 규칙 하나로 함께 정리된다
--         (회원이 아직 말을 하지 않은 상태라 전부 하나의 "묶음"이 되기 때문)
--       - sender_type = 'member' 인 회원 메시지는 이 쿼리에서 절대 건드리지 않는다
--       - 여러 번 실행해도 안전하다: 한 번 정리되면 더 이상 지울 대상이 없어서
--         두 번째 실행부터는 0 rows만 조회/삭제된다
--
-- 사용 방법:
--   1) 아래 "1) 지울 대상 미리보기" SELECT를 먼저 실행해서 지워질 행을 확인한다
--      (이 SELECT는 읽기만 하므로 실행해도 안전하다)
--   2) 확인 후 "2) 실제 삭제" DELETE를 실행한다

-- ========== 1) 지울 대상 미리보기 (아무것도 지우지 않음) ==========
with ordered as (
  select
    id,
    room_id,
    sender_type,
    created_at,
    lag(sender_type) over (partition by room_id order by created_at, id) as prev_sender_type
  from room_messages
),
ai_runs as (
  select
    id,
    room_id,
    created_at,
    sum(case when prev_sender_type is distinct from 'ai_teacher' then 1 else 0 end)
      over (partition by room_id order by created_at, id) as run_no
  from ordered
  where sender_type = 'ai_teacher'
),
ranked as (
  select
    id,
    room_id,
    run_no,
    row_number() over (partition by room_id, run_no order by created_at, id) as rn
  from ai_runs
)
select m.*
from room_messages m
join ranked r on r.id = m.id
where r.rn > 1
  and m.sender_type = 'ai_teacher'
order by m.room_id, m.created_at;

-- ========== 2) 실제 삭제 (위 결과를 확인한 뒤 실행) ==========
with ordered as (
  select
    id,
    room_id,
    sender_type,
    created_at,
    lag(sender_type) over (partition by room_id order by created_at, id) as prev_sender_type
  from room_messages
),
ai_runs as (
  select
    id,
    room_id,
    created_at,
    sum(case when prev_sender_type is distinct from 'ai_teacher' then 1 else 0 end)
      over (partition by room_id order by created_at, id) as run_no
  from ordered
  where sender_type = 'ai_teacher'
),
ranked as (
  select
    id,
    run_no,
    row_number() over (partition by room_id, run_no order by created_at, id) as rn
  from ai_runs
)
delete from room_messages
where sender_type = 'ai_teacher'
  and id in (select id from ranked where rn > 1);
