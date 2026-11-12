-- 그룹과외 3-3 테스트 피드백: AI 학생을 방마다 2명씩 고르게 배치
-- 기존 22명은 방에 1~3명씩 불균등하게 배치돼 있었다(일부 방 1명뿐). 이 마이그레이션은
-- 1) 새 페르소나 2명을 추가하고 2) 기존 학생 2명을 재배치해서, 12개 방 모두 정확히
-- 2명씩(총 24명) 겹치지 않게 배치한다. ai_students.nickname은 전체에서 유니크하므로
-- "겹치지 않음"은 이 유니크 제약으로 이미 보장된다.
-- 여러 번 실행해도 안전하다(닉네임 존재 여부로 가드, UPDATE는 같은 값을 다시 써도 무해).

-- ========== 1) 새 페르소나 2명 추가 ==========
-- "AI 전문가 코스"(공부/고급)와 "나만의 AI 비서 직접 만들어보기"(자유주제/고급)가 1명뿐이라
-- 채워준다.
insert into ai_students (room_id, nickname, persona)
select sr.id, v.nickname, v.persona::jsonb
from (
  values
    ('AI 전문가 코스', '밤새코딩단', '{"ageGroup":"30대","job":"백엔드 개발자","motivation":"최신 AI 논문과 트렌드를 꾸준히 따라가려고","aiLevel":"고급","personality":"질문이 많은 편","role":"질문형","speechStyle":"간결한 존댓말","replyChance":0.3,"typoChance":0.02}'),
    ('나만의 AI 비서 직접 만들어보기', 'N잡러준비생', '{"ageGroup":"30대","job":"N잡 준비 중","motivation":"여러 분야에 AI를 두루 활용해보려고","aiLevel":"고급","personality":"가끔 엉뚱한 말을 하는 편","role":"엉뚱형","speechStyle":"반말체, ㅋㅋ를 자주 씀","replyChance":0.25,"typoChance":0.07}')
) as v(room_name, nickname, persona)
join study_rooms sr on sr.name = v.room_name
where not exists (select 1 from ai_students x where x.nickname = v.nickname);

-- ========== 2) 기존 학생 2명 재배치 ==========
-- "AI 첫걸음: 챗GPT랑 친해지는 30분"(3명)에서 1명을 "뭐든 물어보는 AI 체험반"(1명)으로.
update ai_students
set room_id = (select id from study_rooms where name = '뭐든 물어보는 AI 체험반')
where nickname = '육아맘도전기';

-- "AI 작가 되기: 내 스토리에 살 붙이기"(3명)에서 1명을 "AI로 내 일상 업그레이드하기"(1명)로.
update ai_students
set room_id = (select id from study_rooms where name = 'AI로 내 일상 업그레이드하기')
where nickname = '글쓰기좋아하는사람';

-- ========== 3) 확인용 (결과를 눈으로 보고 싶을 때 직접 실행) ==========
-- select sr.name, count(*) from ai_students a join study_rooms sr on sr.id = a.room_id
-- group by sr.name order by sr.name;
