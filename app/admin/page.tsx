import { isAdminSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getOrderedSubtopicIds } from '@/lib/curriculum'
import AdminLoginForm from '@/components/AdminLoginForm'
import AdminUserTable from '@/components/AdminUserTable'
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
      id: u.id as string,
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

        <AdminUserTable users={users} />
      </div>
    </div>
  )
}
