import Link from 'next/link'
import { getAllLessons, formatPublishedDate } from '@/lib/lessons'

export const metadata = {
  title: '초급 AI 강의 | ELAI',
  description: '매주 업데이트되는 초급 AI 강의. 5분 안에 읽는 핵심 개념, 카드, 퀴즈.',
}

export default function LessonsPage() {
  const lessons = getAllLessons()

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
            매주 월요일 새 강의가 업데이트됩니다.<br />
            5분 안에 읽는 핵심 개념 + 카드 3장 + 퀴즈 1문제.
          </p>
        </div>

        {/* Lesson grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/lessons/${lesson.slug}`}
              className="group bg-white rounded-2xl border border-slate-100 p-7 hover:shadow-md hover:border-secondary-200 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{lesson.emoji}</span>
                  <span className="text-xs font-bold bg-secondary-100 text-secondary-700 px-2.5 py-1 rounded-full">
                    Week {lesson.weekNumber}
                  </span>
                </div>
                <span className="text-xs text-slate-400 mt-1">{lesson.readTime} 읽기</span>
              </div>

              <h2 className="font-bold text-slate-800 text-xl mb-2 group-hover:text-secondary-700 transition-colors leading-snug">
                {lesson.title}
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-5 line-clamp-2">
                {lesson.description}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {formatPublishedDate(lesson.publishedAt)}
                </span>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>📋 핵심 카드 3장</span>
                  <span>✏️ 퀴즈 1문제</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Coming next */}
        <div className="mt-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 p-7 text-center">
          <p className="text-2xl mb-3">🔔</p>
          <p className="font-semibold text-slate-700 mb-1">매주 월요일 새 강의 업데이트</p>
          <p className="text-slate-400 text-sm">Claude AI가 자동으로 생성하는 초급 강의가 매주 추가됩니다</p>
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
