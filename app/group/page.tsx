import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getDb, type DbRoomMember, type DbStudyRoom } from '@/lib/db'
import GroupRoomList, { type GroupRoom } from '@/components/GroupRoomList'
import GroupAiNotice from '@/components/GroupAiNotice'

export const metadata = {
  title: '그룹과외 | ELAI',
}

export const dynamic = 'force-dynamic'

export default async function GroupPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800 mb-2">로그인이 필요해요</h1>
          <p className="text-slate-500 text-sm mb-6">그룹과외는 로그인한 회원만 이용할 수 있어요.</p>
          <Link
            href="/login"
            className="block bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            로그인하러 가기
          </Link>
        </div>
      </div>
    )
  }

  const db = getDb()
  const [{ data: rooms }, { data: members }] = await Promise.all([
    db.from('study_rooms').select('*').order('created_at', { ascending: true }),
    db.from('room_members').select('room_id, user_id, status'),
  ])

  const approvedCountByRoom = new Map<string, number>()
  const myStatusByRoom = new Map<string, DbRoomMember['status']>()
  for (const m of (members ?? []) as Pick<DbRoomMember, 'room_id' | 'user_id' | 'status'>[]) {
    if (m.status === 'approved') {
      approvedCountByRoom.set(m.room_id, (approvedCountByRoom.get(m.room_id) ?? 0) + 1)
    }
    if (m.user_id === user.id) {
      myStatusByRoom.set(m.room_id, m.status)
    }
  }

  const roomList: GroupRoom[] = ((rooms ?? []) as DbStudyRoom[]).map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    level: room.level,
    interest: room.interest,
    maxMembers: room.max_members,
    approvedCount: approvedCountByRoom.get(room.id) ?? 0,
    myStatus: myStatusByRoom.get(room.id) ?? null,
    isRecommended:
      user.onboarding_done && !!user.ai_level && !!user.ai_interest &&
      user.ai_level === room.level && user.ai_interest === room.interest,
  }))

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">그룹과외</h1>
          <p className="text-slate-500 text-sm mt-1">같은 관심분야의 회원들과 함께 AI쌤과 공부해요.</p>
        </div>
        <div className="mb-6">
          <GroupAiNotice />
        </div>
        <GroupRoomList rooms={roomList} />
      </div>
    </div>
  )
}
