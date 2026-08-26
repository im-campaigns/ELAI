'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getLessonsByWeek } from '@/lib/lessons'
import { curriculumLevels, type CurriculumLevel } from '@/data/curriculum'

const levelStyles: Record<
  CurriculumLevel['id'],
  { tag: string; border: string; header: string; accent: string }
> = {
  beginner: {
    tag: 'bg-secondary-100 text-secondary-700',
    border: 'border-secondary-300',
    header: 'bg-secondary-50',
    accent: 'text-secondary-700',
  },
  intermediate: {
    tag: 'bg-primary-100 text-primary-700',
    border: 'border-primary-300',
    header: 'bg-primary-50',
    accent: 'text-primary-700',
  },
  advanced: {
    tag: 'bg-accent-100 text-accent-700',
    border: 'border-accent-300',
    header: 'bg-accent-50',
    accent: 'text-accent-700',
  },
}

function BeginnerModules() {
  const weeks = getLessonsByWeek()

  if (weeks.length === 0) {
    return (
      <p className="text-slate-400 text-sm px-1">아직 등록된 강의가 없어요. 곧 업데이트됩니다!</p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {weeks.map((week) => (
        <div key={week.weekNumber} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-sm transition-shadow">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Week {week.weekNumber}</span>
          <h3 className="font-bold text-slate-800 text-lg mb-3">{week.weekTitle}</h3>
          <ul className="space-y-1.5">
            {week.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/lessons/${lesson.slug}`}
                  className="flex items-start gap-2 text-sm text-slate-600 hover:text-secondary-700 transition-colors group"
                >
                  <span className="mt-0.5 text-slate-300 group-hover:text-secondary-400 flex-shrink-0">▸</span>
                  <span>
                    <span className="font-semibold text-slate-400 mr-1.5">{lesson.lessonNumber}</span>
                    {lesson.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function AccordionModules({ level }: { level: CurriculumLevel }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {level.modules.map((module) => (
        <div key={module.id} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-sm transition-shadow">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{module.title}</span>
          <h3 className="font-bold text-slate-800 text-lg mb-3">{module.title}</h3>
          <ul className="space-y-1.5">
            {module.subtopics.map((topic) => {
              const isOpen = openId === topic.id
              return (
                <li key={topic.id}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : topic.id)}
                    className="w-full flex items-start gap-2 text-sm text-left text-slate-600 hover:text-slate-900 transition-colors group py-0.5"
                  >
                    <span
                      className={`mt-0.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90 text-slate-500' : 'text-slate-300'}`}
                    >
                      ▸
                    </span>
                    <span className="flex-1 font-medium">{topic.title}</span>
                  </button>
                  {isOpen && (
                    <div className="mt-2 mb-3 ml-5 pl-3 border-l-2 border-slate-100 space-y-2.5">
                      <p className="text-xs text-slate-400 italic">{topic.summary}</p>
                      {topic.content.map((p, i) => (
                        <p key={i} className="text-sm text-slate-600 leading-relaxed">
                          {p}
                        </p>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function CurriculumTabs() {
  const searchParams = useSearchParams()
  const initialLevel = searchParams.get('level')
  const validLevel = curriculumLevels.some((l) => l.id === initialLevel)
    ? (initialLevel as CurriculumLevel['id'])
    : 'beginner'

  const [activeLevel, setActiveLevel] = useState<CurriculumLevel['id']>(validLevel)
  const level = useMemo(
    () => curriculumLevels.find((l) => l.id === activeLevel)!,
    [activeLevel],
  )
  const styles = levelStyles[level.id]

  return (
    <>
      {/* Tab switcher */}
      <div className="flex gap-2 justify-center mb-10 flex-wrap">
        {curriculumLevels.map((l) => {
          const isActive = l.id === activeLevel
          const s = levelStyles[l.id]
          return (
            <button
              key={l.id}
              onClick={() => setActiveLevel(l.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all border-2 ${
                isActive
                  ? `${s.tag} ${s.border}`
                  : 'bg-white border-transparent text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{l.emoji}</span>
              <span>{l.label}</span>
            </button>
          )
        })}
      </div>

      <section id={level.id}>
        <div className={`flex items-center gap-3 mb-6 p-5 rounded-2xl ${styles.header} border ${styles.border}`}>
          <span className="text-4xl">{level.emoji}</span>
          <div>
            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-1 ${styles.tag}`}>
              {level.label}
            </span>
            <h2 className="text-2xl font-bold text-slate-800">{level.subtitle}</h2>
            <p className="text-slate-500 text-sm mt-0.5">{level.description}</p>
          </div>
        </div>

        {level.id === 'beginner' ? <BeginnerModules /> : <AccordionModules level={level} />}

        {level.id !== 'beginner' && (
          <p className="text-xs text-slate-400 mt-5 px-1">
            💡 소제목을 클릭하면 해당 개념 설명이 바로 펼쳐져요.
          </p>
        )}
      </section>
    </>
  )
}

export default function CurriculumPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">커리큘럼</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            초급 · 중급 · 고급 3단계로 AI를 처음부터 실전까지 배웁니다.
            모르는 게 있으면 언제든 엘라이 쌤에게 질문하세요!
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 mt-6 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <span>🤖</span>
            <span>엘라이 쌤에게 커리큘럼 질문하기</span>
          </Link>
        </div>

        <Suspense fallback={<div className="text-center text-slate-400 text-sm">불러오는 중...</div>}>
          <CurriculumTabs />
        </Suspense>

        {/* Bottom CTA */}
        <div className="mt-16 text-center bg-gradient-to-r from-primary-600 to-primary-700 rounded-3xl p-12 text-white">
          <h2 className="text-2xl font-bold mb-3">어디서부터 시작해야 할지 모르겠나요?</h2>
          <p className="text-primary-100 mb-6">
            처음이라면 <strong>초급 → Week 1-1</strong>부터 시작하세요. 5분이면 충분해요.
          </p>
          <Link
            href="/lessons"
            className="inline-block bg-white text-primary-700 hover:bg-primary-50 font-bold px-8 py-3.5 rounded-xl transition-colors"
          >
            🌱 초급 AI 상식 시작하기
          </Link>
        </div>
      </div>
    </div>
  )
}
