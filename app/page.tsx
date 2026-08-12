import Link from 'next/link'
import { getAllLessons } from '@/lib/lessons'

const levels = [
  {
    id: 'beginner',
    emoji: '🌱',
    label: '초급',
    color: 'secondary',
    tagClass: 'bg-secondary-100 text-secondary-700',
    borderClass: 'border-secondary-200',
    topics: ['AI란 무엇인가?', 'Python 기초', '데이터 이해하기', '첫 번째 머신러닝 모델'],
    description: 'AI가 처음인 분들을 위한 친절한 입문 과정',
  },
  {
    id: 'intermediate',
    emoji: '🚀',
    label: '중급',
    color: 'primary',
    tagClass: 'bg-primary-100 text-primary-700',
    borderClass: 'border-primary-200',
    topics: ['지도학습 / 비지도학습', '특성 공학', 'scikit-learn 실습', '모델 평가와 튜닝'],
    description: '기초를 넘어 실전 머신러닝에 도전',
  },
  {
    id: 'advanced',
    emoji: '⚡',
    label: '고급',
    color: 'accent',
    tagClass: 'bg-accent-100 text-accent-700',
    borderClass: 'border-accent-200',
    topics: ['딥러닝 & 신경망', 'Transformer & LLM', '프로젝트 배포', 'RAG & 에이전트'],
    description: '최신 LLM과 딥러닝 기술의 최전선',
  },
]

const features = [
  {
    emoji: '🎯',
    title: '레벨별 맞춤 커리큘럼',
    desc: '초급부터 고급까지, 지금 나의 수준에 딱 맞는 학습 경로를 제공합니다.',
  },
  {
    emoji: '🤖',
    title: 'AI 채팅 강사',
    desc: '24시간 언제든지 AI 강사에게 질문하고 즉각적인 설명을 받으세요.',
  },
  {
    emoji: '📚',
    title: '실습 중심 학습',
    desc: '이론뿐만 아니라 실제 코드와 프로젝트로 진짜 실력을 키웁니다.',
  },
  {
    emoji: '🇰🇷',
    title: '완전 한국어 지원',
    desc: '언어 장벽 없이 깊이 있는 AI 개념을 한국어로 배울 수 있습니다.',
  },
]

export default function HomePage() {
  const recentLessons = getAllLessons().slice(-3).reverse()

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block bg-primary-100 text-primary-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            🎉 지금 바로 무료로 시작하세요
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 leading-tight mb-6">
            AI, 이제는 <span className="text-primary-600">쉽고 재미있게</span><br />
            배울 수 있습니다
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            ELAI는 AI를 처음 접하는 분부터 실무에 적용하고 싶은 분까지,
            모든 학습자를 위한 맞춤형 AI 교육 플랫폼입니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/curriculum"
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-base"
            >
              커리큘럼 살펴보기 →
            </Link>
            <Link
              href="/chat"
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-8 py-3.5 rounded-xl transition-colors text-base"
            >
              🤖 AI 강사에게 질문하기
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">왜 ELAI인가요?</h2>
            <p className="text-slate-500">학습자 중심으로 설계된 AI 교육의 새로운 기준</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-slate-100 bg-slate-50 hover:border-primary-200 hover:bg-primary-50 transition-colors">
                <div className="text-3xl mb-4">{f.emoji}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Curriculum Preview */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">레벨별 커리큘럼 미리보기</h2>
            <p className="text-slate-500">지금 나의 수준에서 시작하면 됩니다. 어디서든 함께합니다.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {levels.map((level) => (
              <div
                key={level.id}
                className={`bg-white rounded-2xl border-2 ${level.borderClass} p-7 flex flex-col`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{level.emoji}</span>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${level.tagClass}`}>
                    {level.label}
                  </span>
                </div>
                <p className="text-slate-500 text-sm mb-5">{level.description}</p>
                <ul className="space-y-2 flex-1">
                  {level.topics.map((topic) => (
                    <li key={topic} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="text-slate-300">•</span>
                      {topic}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/curriculum#${level.id}`}
                  className="mt-6 text-center block border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  자세히 보기
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Lessons */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="inline-block bg-secondary-100 text-secondary-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
                🌱 평일 매일 업데이트
              </div>
              <h2 className="text-3xl font-bold text-slate-800">최신 초급 강의</h2>
              <p className="text-slate-500 mt-1">5분 안에 읽는 AI 개념 + 핵심 카드 + 퀴즈</p>
            </div>
            <Link
              href="/lessons"
              className="hidden sm:inline-flex text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              전체 강의 보기 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recentLessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/lessons/${lesson.slug}`}
                className="group bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-md hover:border-secondary-200 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">{lesson.emoji}</span>
                  <span className="text-xs font-bold bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full">
                    {lesson.lessonNumber}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 mb-2 group-hover:text-secondary-700 transition-colors leading-snug">
                  {lesson.title}
                </h3>
                <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed mb-4">
                  {lesson.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>⏱ {lesson.readTime}</span>
                  <span>📋 카드 3장</span>
                  <span>✏️ 퀴즈</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center sm:hidden">
            <Link
              href="/lessons"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              전체 강의 보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">지금 AI 강사에게 첫 질문을 해보세요</h2>
          <p className="text-primary-100 mb-8 text-lg">
            "AI가 뭔지도 모르겠어요"부터 "트랜스포머 구조 설명해줘"까지,<br />
            어떤 질문도 환영합니다.
          </p>
          <Link
            href="/chat"
            className="inline-block bg-white text-primary-700 hover:bg-primary-50 font-bold px-10 py-4 rounded-xl transition-colors text-base"
          >
            🤖 무료로 AI 강사 만나기
          </Link>
        </div>
      </section>
    </div>
  )
}
