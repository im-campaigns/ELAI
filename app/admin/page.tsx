import { isAdminSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import type { AiInterest, AiLevel, DbAiStudent, DbRoomMember, DbStudyRoom } from '@/lib/db'
import { getOrderedSubtopicIds } from '@/lib/curriculum'
import AdminLoginForm from '@/components/AdminLoginForm'
import AdminUserTable from '@/components/AdminUserTable'
import AdminRoomPanel, { type AdminPendingApplication, type AdminRoomOverview } from '@/components/AdminRoomPanel'
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

type MemberWithUser = Pick<DbRoomMember, 'room_id' | 'user_id' | 'status' | 'requested_at'> & {
  users: { nickname: string; job: string | null; ai_level: AiLevel | null; ai_interest: AiInterest | null } | null
}

async function loadRoomsAdmin() {
  const db = getDb()
  const [{ data: rooms }, { data: members }, { data: aiStudents }] = await Promise.all([
    db.from('study_rooms').select('*').order('created_at', { ascending: true }),
    db
      .from('room_members')
      .select('room_id, user_id, status, requested_at, users(nickname, job, ai_level, ai_interest)')
      .order('requested_at', { ascending: true }),
    db.from('ai_students').select('*').order('created_at', { ascending: true }),
  ])

  const roomList = (rooms ?? []) as DbStudyRoom[]
  const roomNameById = new Map(roomList.map((r) => [r.id, r.name]))

  const approvedCountByRoom = new Map<string, number>()
  const pendingCountByRoom = new Map<string, number>()
  const pending: AdminPendingApplication[] = []

  for (const m of (members ?? []) as unknown as MemberWithUser[]) {
    if (m.status === 'approved') {
      approvedCountByRoom.set(m.room_id, (approvedCountByRoom.get(m.room_id) ?? 0) + 1)
    } else if (m.status === 'pending') {
      pendingCountByRoom.set(m.room_id, (pendingCountByRoom.get(m.room_id) ?? 0) + 1)
      pending.push({
        roomId: m.room_id,
        userId: m.user_id,
        roomName: roomNameById.get(m.room_id) ?? '알 수 없는 방',
        nickname: m.users?.nickname ?? '알 수 없음',
        job: m.users?.job ?? null,
        level: m.users?.ai_level ?? null,
        interest: m.users?.ai_interest ?? null,
        requestedAt: m.requested_at,
      })
    }
  }

  const aiStudentsByRoom = new Map<string, AdminRoomOverview['aiStudents']>()
  for (const s of (aiStudents ?? []) as DbAiStudent[]) {
    const list = aiStudentsByRoom.get(s.room_id) ?? []
    list.push({
      id: s.id,
      nickname: s.nickname,
      persona: s.persona,
      isActive: s.is_active,
    })
    aiStudentsByRoom.set(s.room_id, list)
  }

  const roomsResult: AdminRoomOverview[] = roomList.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    level: room.level,
    interest: room.interest,
    maxMembers: room.max_members,
    approvedCount: approvedCountByRoom.get(room.id) ?? 0,
    pendingCount: pendingCountByRoom.get(room.id) ?? 0,
    aiStudents: aiStudentsByRoom.get(room.id) ?? [],
  }))

  return { rooms: roomsResult, pending }
}

export default async function AdminPage() {
  if (!isAdminSession()) {
    return <AdminLoginForm />
  }

  const users = await loadUsers()
  const { rooms, pending } = await loadRoomsAdmin()

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

        <div className="mt-12">
          <h1 className="text-2xl font-bold text-slate-800 mb-6">그룹과외</h1>
          <AdminRoomPanel rooms={rooms} pending={pending} />
        </div>
      </div>
    </div>
  )
}
