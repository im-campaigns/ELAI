-- 그룹과외 방 12개의 제목/소개 문구를 실용적이고 재미있는 수업처럼 변경
-- 레벨/분류는 건드리지 않고 name, description만 바꾼다.
-- 기존(배포 시점) 이름으로 매칭해서 UPDATE하므로, 이미 한 번 실행했거나 이름을 아직
-- 안 바꾼 환경 모두에서 안전하다(이미 바뀐 행은 WHERE에 안 걸려 0 rows).

update study_rooms set
  name = '칼퇴 첫걸음: 챗GPT로 이메일 5분 끝내기',
  description = '매일 쓰는 이메일·메모 작성을 AI로 빠르게 끝내는 법부터 배워요.'
where name = 'AI 업무활용 입문반';

update study_rooms set
  name = 'AI 첫걸음: 챗GPT랑 친해지는 30분',
  description = 'AI가 뭔지, 어떻게 질문해야 잘 답해주는지부터 차근차근 알아가요.'
where name = 'AI 공부 입문반';

update study_rooms set
  name = 'AI로 내 첫 그림책 만들기',
  description = '글과 그림을 AI로 뽑아보며 나만의 짧은 이야기를 완성해봐요.'
where name = 'AI 창작 입문반';

update study_rooms set
  name = '뭐든 물어보는 AI 체험반',
  description = '주제 안 가리고 평소 궁금했던 걸 AI한테 마음껏 물어보는 시간이에요.'
where name = 'AI 기타 입문반';

update study_rooms set
  name = '칼퇴 프로젝트: 보고서·엑셀 AI로 끝내기',
  description = '보고서 초안, 엑셀 정리처럼 시간 잡아먹는 업무를 AI로 줄여봐요.'
where name = 'AI 업무활용 중급반';

update study_rooms set
  name = 'AI 개념 한 단계 업그레이드',
  description = '프롬프트 작성법과 AI 작동 원리를 더 깊이 이해해봐요.'
where name = 'AI 공부 중급반';

update study_rooms set
  name = 'AI 작가 되기: 내 스토리에 살 붙이기',
  description = '짧은 아이디어를 AI와 함께 완성도 있는 글·이미지로 키워봐요.'
where name = 'AI 창작 중급반';

update study_rooms set
  name = 'AI로 내 일상 업그레이드하기',
  description = '일정 관리, 정보 검색 등 일상 곳곳에 AI를 제대로 써먹어봐요.'
where name = 'AI 기타 중급반';

update study_rooms set
  name = '회사 AI 전략가 되기',
  description = '업무 자동화를 설계하고 팀에 AI 활용법을 전파하는 수준까지 올라가요.'
where name = 'AI 업무활용 고급반';

update study_rooms set
  name = 'AI 전문가 코스',
  description = '최신 AI 모델과 트렌드를 깊이 파고들어 전문가 수준으로 공부해요.'
where name = 'AI 공부 고급반';

update study_rooms set
  name = '나만의 AI 창작 스튜디오 만들기',
  description = '여러 AI 도구를 조합해 완성도 높은 창작 결과물을 만들어봐요.'
where name = 'AI 창작 고급반';

update study_rooms set
  name = '나만의 AI 비서 직접 만들어보기',
  description = '자동화·연동까지 다뤄보며 나만 쓰는 AI 비서를 직접 설계해봐요.'
where name = 'AI 기타 고급반';
