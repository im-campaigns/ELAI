-- 그룹과외 3-3 테스트 피드백: AI 무한 반복/비용 방지 2차 방어선
-- 여러 번 실행해도 안전하다(create or replace / if not exists).

-- ========== 1) AI 메시지는 "회원 메시지"만 트리거할 수 있다 ==========
-- 앱 코드는 이미 member 메시지의 id로만 triggered_by를 채우지만, DB 레벨에서도 한 번 더
-- 강제한다. ai_teacher/ai_student 메시지의 triggered_by가 가리키는 메시지는 반드시
-- sender_type = 'member'여야 하며, 그렇지 않으면 insert 자체를 막는다.
create or replace function enforce_ai_trigger_is_member() returns trigger as $$
declare
  trigger_sender text;
begin
  if new.triggered_by is not null and new.sender_type in ('ai_teacher', 'ai_student') then
    select sender_type into trigger_sender from room_messages where id = new.triggered_by;
    if trigger_sender is distinct from 'member' then
      raise exception 'AI messages can only be triggered by a member message (triggered_by=%, sender_type=%)',
        new.triggered_by, trigger_sender;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists room_messages_enforce_ai_trigger on room_messages;
create trigger room_messages_enforce_ai_trigger
  before insert on room_messages
  for each row
  execute function enforce_ai_trigger_is_member();

-- ========== 2) 방별 하루 AI 메시지 상한 / 전체 하루 토큰 예산 집계용 인덱스 ==========
-- "방별로 오늘 ai_teacher/ai_student가 몇 개 쌓였는지"를 빠르게 세기 위한 인덱스.
create index if not exists room_messages_room_sender_created_idx
  on room_messages (room_id, sender_type, created_at);

-- "오늘 전체 토큰 사용량 합"을 빠르게 구하기 위한 인덱스.
create index if not exists ai_usage_log_created_at_idx on ai_usage_log (created_at);
