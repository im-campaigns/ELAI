import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDb, type DbRoomMember, type DbStudyRoom } from '@/lib/db'
import { ConfigError } from '@/lib/errors'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const [{ data: rooms, error: roomsError }, { data: members, error: membersError }] = await Promise.all([
      db.from('study_rooms').select('*').order('created_at', { ascending: true }),
      db.from('room_members').select('room_id, user_id, status'),
    ])

    if (roomsError || membersError) {
      console.error('[rooms GET] fetch failed:', roomsError, membersError)
      return NextResponse.json({ error: '방 목록을 불러오지 못했어요.' }, { status: 500 })
    }

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

    const result = ((rooms ?? []) as DbStudyRoom[]).map((room) => ({
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

    return NextResponse.json({ rooms: result })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[rooms GET] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
