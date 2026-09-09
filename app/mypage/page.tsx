import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { curriculumLevels } from '@/data/curriculum'
import LogoutButton from '@/components/LogoutButton'

export const metadata = {
  title: '마이페이지 | ELAI',
}

const levelMeta: Record<string, { emoji: string; label: string }> = {
  beginner: { emoji: '🌱', label: '초급' },
  intermediate: { emoji: '🚀', label: '중급' },
  advanced: { emoji: '⚡', label: '고급' },
}

export default async function MyPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: progressRows } = await getDb()
    .from('curriculum_progress')
    .select('level, subtopic_id')
    .eq('user_id', user.id)

  const { count: chatCount } = await getDb()
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')

  const completedByLevel: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0 }
  for (const row of progressRows ?? []) {
    completedByLevel[row.level] = (completedByLevel[row.level] ?? 0) + 1
  }

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block bg-primary-100 text-primary-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
            👤 마이페이지
          </div>
          <h1 className="text-3xl font-bold text-slate-800">{user.nickname}님, 안녕하세요!</h1>
          {user.email && <p className="text-slate-400 text-sm mt-2">{user.email}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
          <h2 className="font-bold text-slate-800 mb-4">커리큘럼 진도</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {curriculumLevels.map((level) => {
              const total = level.modules.reduce((sum, m) => sum + m.subtopics.length, 0)
              const done = completedByLevel[level.id] ?? 0
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <Link
                  key={level.id}
                  href={`/curriculum?level=${level.id}`}
                  className="border border-slate-100 rounded-xl p-4 hover:border-primary-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{levelMeta[level.id].emoji}</span>
                    <span className="font-semibold text-slate-700 text-sm">{levelMeta[level.id].label}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {done} / {total} 완료 ({pct}%)
                  </p>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
          <h2 className="font-bold text-slate-800 mb-3">나의 활동 기록</h2>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="text-2xl">💬</span>
            <span>AI쌤에게 총 {chatCount ?? 0}개의 질문을 보냈어요.</span>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-primary-600 hover:underline"
          >
            AI쌤과 이어서 대화하기 →
          </Link>
        </div>

        <div className="text-center">
          <LogoutButton className="text-sm text-slate-400 hover:text-slate-600 transition-colors underline" />
        </div>
      </div>
    </div>
  )
}
