'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { curriculumLevels, type CurriculumLevel, type CurriculumSubtopic } from '@/data/curriculum'

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

type Progress = Record<string, string[]>

function useAuthAndProgress() {
  const [nickname, setNickname] = useState<string | null | undefined>(undefined) // undefined = loading
  const [progress, setProgress] = useState<Progress>({ beginner: [], intermediate: [], advanced: [] })

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setNickname(data?.user?.nickname ?? null))
      .catch(() => setNickname(null))
  }, [])

  useEffect(() => {
    if (!nickname) return
    fetch('/api/curriculum/progress')
      .then((res) => (res.ok ? res.json() : { progress: {} }))
      .then((data) => setProgress({ beginner: [], intermediate: [], advanced: [], ...data.progress }))
      .catch(() => {})
  }, [nickname])

  const markComplete = async (level: string, subtopicId: string) => {
    setProgress((prev) => ({
      ...prev,
      [level]: prev[level]?.includes(subtopicId) ? prev[level] : [...(prev[level] ?? []), subtopicId],
    }))
    try {
      await fetch('/api/curriculum/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, subtopicId }),
      })
    } catch {
      // best-effort; UI already optimistically unlocked
    }
  }

  return { nickname, progress, markComplete }
}

function CaseExampleCorner({ subtopic }: { subtopic: CurriculumSubtopic }) {
  return (
    <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
      <p className="text-xs font-bold text-amber-700 mb-2">💡 사례 코너 — {subtopic.caseExample.title}</p>
      <p className="text-sm text-amber-900 leading-relaxed mb-2">{subtopic.caseExample.scenario}</p>
      <p className="text-xs text-amber-700 font-medium">👉 {subtopic.caseExample.takeaway}</p>
    </div>
  )
}

function ModuleAccordion({
  level,
  isLoggedIn,
  progress,
  markComplete,
}: {
  level: CurriculumLevel
  isLoggedIn: boolean
  progress: string[]
  markComplete: (level: string, subtopicId: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  const orderedIds = useMemo(
    () => level.modules.flatMap((m) => m.subtopics.map((s) => s.id)),
    [level],
  )

  const isUnlocked = (subtopicId: string) => {
    if (!isLoggedIn) return false
    const idx = orderedIds.indexOf(subtopicId)
    if (idx === 0) return true
    return progress.includes(orderedIds[idx - 1])
  }

  const handleToggle = (subtopic: CurriculumSubtopic) => {
    if (!isUnlocked(subtopic.id)) return
    const willOpen = openId !== subtopic.id
    setOpenId(willOpen ? subtopic.id : null)
    if (willOpen && !progress.includes(subtopic.id)) {
      markComplete(level.id, subtopic.id)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {level.modules.map((module) => (
        <div key={module.id} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-sm transition-shadow">
          <h3 className="font-bold text-slate-800 text-lg mb-3">{module.title}</h3>
          <ul className="space-y-1.5">
            {module.subtopics.map((topic) => {
              const isOpen = openId === topic.id
              const unlocked = isUnlocked(topic.id)
              const done = progress.includes(topic.id)
              return (
                <li key={topic.id}>
                  <button
                    onClick={() => handleToggle(topic)}
                    disabled={!unlocked}
                    className={`w-full flex items-start gap-2 text-sm text-left transition-colors group py-0.5 ${
                      unlocked ? 'text-slate-600 hover:text-slate-900 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90 text-slate-500' : unlocked ? 'text-slate-300' : 'text-slate-200'}`}
                    >
                      {unlocked ? '▸' : '🔒'}
                    </span>
                    <span className="flex-1 font-medium">{topic.title}</span>
                    {done && <span className="text-secondary-500 text-xs flex-shrink-0">✓</span>}
                  </button>
                  {isOpen && unlocked && (
                    <div className="mt-2 mb-3 ml-5 pl-3 border-l-2 border-slate-100 space-y-2.5">
                      <p className="text-xs text-slate-400 italic">{topic.summary}</p>
                      {topic.content.map((p, i) => (
                        <p key={i} className="text-sm text-slate-600 leading-relaxed">
                          {p}
                        </p>
                      ))}
                      <CaseExampleCorner subtopic={topic} />
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

function LoginGate() {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
      <p className="text-3xl mb-3">🔒</p>
      <p className="font-semibold text-slate-700 mb-2">로그인하면 커리큘럼을 시작할 수 있어요</p>
      <p className="text-slate-400 text-sm mb-6">
        순서대로 하나씩 읽으면 다음 진도가 열리는 방식이에요. 로그인 후 나의 진도가 저장돼요.
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          href="/login"
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
        >
          회원가입
        </Link>
      </div>
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
  const { nickname, progress, markComplete } = useAuthAndProgress()
  const isLoggedIn = !!nickname
  const isLoading = nickname === undefined

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

        {isLoading ? (
          <p className="text-center text-slate-400 text-sm py-10">불러오는 중...</p>
        ) : isLoggedIn ? (
          <ModuleAccordion
            level={level}
            isLoggedIn={isLoggedIn}
            progress={progress[level.id] ?? []}
            markComplete={markComplete}
          />
        ) : (
          <LoginGate />
        )}

        {isLoggedIn && (
          <p className="text-xs text-slate-400 mt-5 px-1">
            💡 열려 있는 소제목을 클릭하면 설명과 사례 코너가 펼쳐지고, 다음 주제가 열려요.
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
            모르는 게 있으면 언제든 AI쌤에게 질문하세요!
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 mt-6 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <span>🤖</span>
            <span>AI쌤에게 커리큘럼 질문하기</span>
          </Link>
        </div>

        <Suspense fallback={<div className="text-center text-slate-400 text-sm">불러오는 중...</div>}>
          <CurriculumTabs />
        </Suspense>

        {/* Bottom CTA */}
        <div className="mt-16 text-center bg-gradient-to-r from-primary-600 to-primary-700 rounded-3xl p-12 text-white">
          <h2 className="text-2xl font-bold mb-3">어디서부터 시작해야 할지 모르겠나요?</h2>
          <p className="text-primary-100 mb-6">
            처음이라면 <strong>초급</strong>부터 로그인 후 순서대로 시작하세요.
          </p>
          <Link
            href="/lessons"
            className="inline-block bg-white text-primary-700 hover:bg-primary-50 font-bold px-8 py-3.5 rounded-xl transition-colors"
          >
            🌱 AI 상식 4주 코스도 확인해보세요
          </Link>
        </div>
      </div>
    </div>
  )
}
