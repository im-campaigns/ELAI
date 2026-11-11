-- '기타' 관심분야를 '자유주제'로 이름 변경
-- 이유: AI쌤이 방 분류 '기타'를 악기 "기타(guitar)"로 오해해서 🎸 비유를 반복해 쓰는 문제가 있었다.
-- 여러 번 실행해도 안전하다: 이미 '자유주제'로 바뀐 행은 두 번째 UPDATE부터 0 rows만 영향받는다.

-- ========== 1) 체크 제약을 새 값으로 다시 만든다 ==========
alter table study_rooms drop constraint if exists study_rooms_interest_check;
alter table study_rooms add constraint study_rooms_interest_check
  check (interest in ('업무활용', '공부', '창작', '자유주제'));

alter table users drop constraint if exists users_ai_interest_check;
alter table users add constraint users_ai_interest_check
  check (ai_interest is null or ai_interest in ('업무활용', '공부', '창작', '자유주제'));

-- ========== 2) 기존 데이터의 '기타' 값을 '자유주제'로 변경 ==========
-- (ai_students.persona에는 interest가 저장되지 않으므로 건드릴 필요 없음 — 방의 interest는 study_rooms에만 있음)
update study_rooms set interest = '자유주제' where interest = '기타';
update users set ai_interest = '자유주제' where ai_interest = '기타';
