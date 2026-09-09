import { isAdminSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getOrderedSubtopicIds } from '@/lib/curriculum'
import AdminLoginForm from '@/components/AdminLoginForm'
import LogoutButton from '@/components/LogoutButton'

export const metadata = {
  title: '관리자 | ELAI',
}

export const dynamic = 'force-dynamic'

async function loadUsers() {
  const db = getDb()
  const [{ data: users }, { data: progress }] = await Promise.all([
    db.from('users').select('id, nickname, email, created_at').order('created_at', { ascending: false }),
    db.from('curriculum_progress').select('user_id, level, subtopic_id'),
  ])

  const totals = {
    beginner: getOrderedSubtopicIds('beginner').length,
    intermediate: getOrderedSubtopicIds('intermediate').length,
    advanced: getOrderedSubtopicIds('advanced').length,
  }

  const progressByUser = new Map<string, Record<string, number>>()
  for (const row of progress ?? []) {
    const entry = progressByUser.get(row.user_id) ?? { beginner: 0, intermediate: 0, advanced: 0 }
    entry[row.level] = (entry[row.level] ?? 0) + 1
    progressByUser.set(row.user_id, entry)
  }

  return (users ?? []).map((u) => {
    const done = progressByUser.get(u.id) ?? { beginner: 0, intermediate: 0, advanced: 0 }
    return {
      nickname: u.nickname as string,
      email: u.email as string | null,
      createdAt: u.created_at as string,
      progress: {
        beginner: `${done.beginner ?? 0} / ${totals.beginner}`,
        intermediate: `${done.intermediate ?? 0} / ${totals.intermediate}`,
        advanced: `${done.advanced ?? 0} / ${totals.advanced}`,
      },
    }
  })
}

export default async function AdminPage() {
  if (!isAdminSession()) {
    return <AdminLoginForm />
  }

  const users = await loadUsers()

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">관리자 페이지</h1>
            <p className="text-slate-500 text-sm mt-1">전체 회원 {users.length}명</p>
          </div>
          <LogoutButton
            endpoint="/api/admin/logout"
            redirectTo="/admin"
            label="관리자 로그아웃"
            className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-4 py-2 transition-colors"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">닉네임</th>
                <th className="px-5 py-3 font-semibold">이메일</th>
                <th className="px-5 py-3 font-semibold">가입일</th>
                <th className="px-5 py-3 font-semibold">초급 진도</th>
                <th className="px-5 py-3 font-semibold">중급 진도</th>
                <th className="px-5 py-3 font-semibold">고급 진도</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.nickname} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-700">{u.nickname}</td>
                  <td className="px-5 py-3 text-slate-500">{u.email ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{u.progress.beginner}</td>
                  <td className="px-5 py-3 text-slate-600">{u.progress.intermediate}</td>
                  <td className="px-5 py-3 text-slate-600">{u.progress.advanced}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    아직 가입한 회원이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
