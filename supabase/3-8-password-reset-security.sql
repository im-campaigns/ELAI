-- 관리자 비밀번호 초기화 보안 강화
-- 기존에는 관리자가 비밀번호를 초기화하면 항상 고정값 '1234'로 바뀌었다. 이제는 무작위
-- 임시 비밀번호로 바꾸고, 해당 회원이 다음 로그인 때 반드시 새 비밀번호로 바꾸게 강제한다.
-- 여러 번 실행해도 안전하다(if not exists).

alter table users add column if not exists must_change_password boolean not null default false;
