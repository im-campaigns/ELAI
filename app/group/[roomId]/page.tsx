import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getDb, type DbStudyRoom } from '@/lib/db'
import RoomChat from '@/components/RoomChat'

export const metadata = {
  title: '그룹과외 방 | ELAI',
}

export const dynamic = 'force-dynamic'

function GuardCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-8 text-center">
        <h1 className="text-xl font-bold text-slate-800 mb-2">{title}</h1>
        <p className="text-slate-500 text-sm mb-6">{message}</p>
        <Link
          href="/group"
          className="block bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          그룹과외 목록으로
        </Link>
      </div>
    </div>
  )
}

export default async function GroupRoomPage({ params }: { params: { roomId: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return <GuardCard title="로그인이 필요해요" message="그룹과외는 로그인한 회원만 이용할 수 있어요." />
  }

  const db = getDb()
  const { data: room } = await db
    .from('study_rooms')
    .select('*')
    .eq('id', params.roomId)
    .maybeSingle()

  if (!room) {
    return <GuardCard title="존재하지 않는 방이에요" message="방 주소를 다시 확인해주세요." />
  }

  const { data: membership } = await db
    .from('room_members')
    .select('status')
    .eq('room_id', params.roomId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.status !== 'approved') {
    return (
      <GuardCard
        title="입장할 수 없어요"
        message="운영자 승인을 받은 회원만 이 방에 들어올 수 있어요."
      />
    )
  }

  const typedRoom = room as DbStudyRoom

  const { count: approvedCount } = await db
    .from('room_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('room_id', params.roomId)
    .eq('status', 'approved')

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg font-bold text-slate-800">{typedRoom.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{typedRoom.description}</p>
          <p className="text-xs text-slate-400 mt-1">승인된 회원 {approvedCount ?? 0}명</p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="max-w-3xl mx-auto h-full">
          <RoomChat roomId={typedRoom.id} currentUserId={user.id} />
        </div>
      </div>
    </div>
  )
}
