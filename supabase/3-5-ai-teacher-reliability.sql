-- AI쌤 "답변 누락" 버그 수정을 위한 DB 보강
-- 기존에는 "가장 최근 메시지가 AI쌤이면 응답하지 않는다"는 생성 시각(created_at) 기준
-- 휴리스틱으로 중복 응답을 막았는데, AI 학생/보정 메시지가 지연 표시(visible_at)되는
-- 구조와 맞물려 정상적인 질문에 아무 응답도 안 남기고 조용히 넘어가는 경우가 있었다.
-- 이제는 AI 학생과 동일한 방식으로, AI쌤 응답도 트리거가 된 회원 메시지(triggered_by)에
-- 묶어서 저장하고, 회원 메시지 1개당 AI쌤 응답 최대 1개를 DB 유니크 인덱스로 보장한다.
-- 여러 번 실행해도 안전하다(if not exists).

create unique index if not exists room_messages_ai_teacher_trigger_once_idx
  on room_messages (triggered_by)
  where sender_type = 'ai_teacher' and triggered_by is not null;

-- 사용자별 AI쌤 호출 횟수(분당/일별 한도)를 빠르게 세기 위한 인덱스.
create index if not exists room_messages_room_user_sender_created_idx
  on room_messages (room_id, user_id, sender_type, created_at);
