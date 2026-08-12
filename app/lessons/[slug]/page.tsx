import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLessonBySlug, getAdjacentLessons, getAllLessons, formatPublishedDate } from '@/lib/lessons'
import QuizCard from '@/components/QuizCard'

type Props = { params: { slug: string } }

export async function generateStaticParams() {
  return getAllLessons().map((l) => ({ slug: l.slug }))
}

export async function generateMetadata({ params }: Props) {
  const lesson = getLessonBySlug(params.slug)
  if (!lesson) return {}
  return {
    title: `${lesson.title} | ELAI 초급 강의`,
    description: lesson.description,
  }
}

export default function LessonPage({ params }: Props) {
  const lesson = getLessonBySlug(params.slug)
  if (!lesson) notFound()

  const { prev, next } = getAdjacentLessons(params.slug)

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
          <Link href="/lessons" className="hover:text-slate-600 transition-colors">
            강의 목록
          </Link>
          <span>/</span>
          <span className="text-slate-600">Week {lesson.weekNumber} · {lesson.weekTitle}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-100 p-8 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-4xl">{lesson.emoji}</span>
            <div>
              <span className="inline-block bg-secondary-100 text-secondary-700 text-xs font-bold px-2.5 py-1 rounded-full mb-1">
                {lesson.lessonNumber} · {lesson.dayLabel}요일 · 초급
              </span>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>⏱ {lesson.readTime} 읽기</span>
                <span>{formatPublishedDate(lesson.publishedAt)}</span>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 leading-tight mb-3">
            {lesson.title}
          </h1>
          <p className="text-slate-500 leading-relaxed">{lesson.description}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-100 p-8 mb-6">
          <div className="prose prose-slate max-w-none">
            {lesson.content.map((paragraph, i) => (
              <p key={i} className="text-slate-700 leading-relaxed mb-4 last:mb-0 text-base">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Key Cards */}
        <div className="mb-6">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-3 px-1">
            📋 핵심 카드 3장
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {lesson.keyCards.map((card, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-100 p-6 flex gap-4 items-start"
              >
                <span className="text-3xl flex-shrink-0 mt-0.5">{card.emoji}</span>
                <div>
                  <h3 className="font-bold text-slate-800 mb-1.5">{card.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{card.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quiz */}
        <div className="mb-8">
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-3 px-1">
            ✏️ 오늘의 퀴즈
          </h2>
          <QuizCard quiz={lesson.quiz} />
        </div>

        {/* Ask AI */}
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100 rounded-2xl p-6 mb-8 flex items-center gap-4">
          <span className="text-3xl">🤖</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-700 mb-0.5">이해가 안 되는 부분이 있나요?</p>
            <p className="text-slate-500 text-sm">AI 강사에게 바로 질문해보세요.</p>
          </div>
          <Link
            href="/chat"
            className="flex-shrink-0 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            질문하기
          </Link>
        </div>

        {/* Prev / Next navigation */}
        <div className="grid grid-cols-2 gap-4">
          {prev ? (
            <Link
              href={`/lessons/${prev.slug}`}
              className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-sm transition-all group"
            >
              <p className="text-xs text-slate-400 mb-1">← 이전 강의</p>
              <p className="font-semibold text-slate-700 text-sm group-hover:text-primary-600 transition-colors line-clamp-2">
                {prev.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/lessons/${next.slug}`}
              className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-sm transition-all group text-right"
            >
              <p className="text-xs text-slate-400 mb-1">다음 강의 →</p>
              <p className="font-semibold text-slate-700 text-sm group-hover:text-primary-600 transition-colors line-clamp-2">
                {next.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/lessons"
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors underline"
          >
            전체 강의 목록으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
