import Link from 'next/link'
import { getLessonsByWeek, DAY_LABELS } from '@/lib/lessons'

export const metadata = {
  title: '초급 AI 강의 | ELAI',
  description: '평일 매일 업데이트되는 초급 AI 강의. 5분 안에 읽는 핵심 개념, 카드, 퀴즈.',
}

export default function LessonsPage() {
  const weeks = getLessonsByWeek()

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-block bg-secondary-100 text-secondary-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
            🌱 초급 커리큘럼
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-4">AI 기초 강의</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            월~금 매일 새 강의가 업데이트됩니다. Week 단위로 주제를 모아 5일간 배워요.<br />
            5분 안에 읽는 핵심 개념 + 카드 3장 + 퀴즈 1문제.
          </p>
        </div>

        {/* Weeks */}
        <div className="space-y-10">
          {weeks.map((week) => (
            <section key={week.weekNumber}>
              <div className="flex items-center gap-3 mb-4 px-1">
                <span className="text-xs font-bold bg-secondary-100 text-secondary-700 px-2.5 py-1 rounded-full">
                  Week {week.weekNumber}
                </span>
                <h2 className="font-bold text-slate-800 text-xl">{week.weekTitle}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {DAY_LABELS.map((dayLabel, i) => {
                  const dayIndex = i + 1
                  const lesson = week.lessons.find((l) => l.dayIndex === dayIndex)

                  if (!lesson) {
                    return (
                      <div
                        key={dayLabel}
                        className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-5 flex flex-col items-center justify-center text-center opacity-60"
                      >
                        <span className="text-xs font-bold text-slate-300 mb-2">{dayLabel}</span>
                        <span className="text-2xl mb-1">🔒</span>
                        <span className="text-xs text-slate-400">예정</span>
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={lesson.id}
                      href={`/lessons/${lesson.slug}`}
                      className="group bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:border-secondary-200 transition-all flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-400">{lesson.dayLabel}</span>
                        <span className="text-2xl">{lesson.emoji}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-secondary-700 transition-colors leading-snug">
                        {lesson.title}
                      </h3>
                      <p className="text-slate-400 text-xs mt-auto pt-2">{lesson.readTime} 읽기</p>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Coming next */}
        <div className="mt-10 bg-white rounded-2xl border-2 border-dashed border-slate-200 p-7 text-center">
          <p className="text-2xl mb-3">🔔</p>
          <p className="font-semibold text-slate-700 mb-1">평일 매일 새 강의 업데이트</p>
          <p className="text-slate-400 text-sm">Claude AI가 자동으로 생성하는 초급 강의가 월~금 매일 추가됩니다</p>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-3xl p-10 text-white text-center">
          <h2 className="text-2xl font-bold mb-3">강의를 읽다가 모르는 게 생겼나요?</h2>
          <p className="text-secondary-100 mb-6 text-sm">
            AI 강사에게 바로 질문하면 즉각적인 설명을 받을 수 있어요.
          </p>
          <Link
            href="/chat"
            className="inline-block bg-white text-secondary-700 hover:bg-secondary-50 font-bold px-8 py-3.5 rounded-xl transition-colors text-sm"
          >
            🤖 AI 강사에게 질문하기
          </Link>
        </div>
      </div>
    </div>
  )
}
