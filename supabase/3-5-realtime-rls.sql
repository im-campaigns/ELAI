-- Supabase Realtime을 위한 범위 제한 접근
-- 이 앱은 Supabase Auth를 쓰지 않고 자체 쿠키 세션을 쓰므로, anon/authenticated 롤에는
-- 기본적으로 아무 접근 권한이 없다(schema.sql 참고). 브라우저가 room_messages의 실시간
-- 변경을 구독하려면 서버가 "승인된 멤버십을 확인한 뒤" 발급한 단기 JWT가 필요하고,
-- 그 토큰의 room_id 클레임과 일치하는 방의 메시지만 읽을 수 있도록 아래 정책으로 제한한다.
-- (토큰 발급: app/api/group/[roomId]/realtime-token)
-- 여러 번 실행해도 안전하다.

drop policy if exists room_messages_realtime_select on room_messages;
create policy room_messages_realtime_select on room_messages
  for select
  using (room_id::text = (auth.jwt() ->> 'room_id'));

-- room_messages를 Realtime 복제 대상에 추가한다(이미 추가돼 있으면 건너뛴다).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'room_messages'
  ) then
    alter publication supabase_realtime add table room_messages;
  end if;
end $$;
