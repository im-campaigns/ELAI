import { NextResponse } from 'next/server'
import { getDb, type DbStudyRoom } from '@/lib/db'

/**
 * 승인된 회원만 방에 접근하도록 확인한다. (Next.js 라우트 파일은 정해진 이름만 export할 수 있어서
 * 여러 라우트가 함께 쓰는 이 함수는 lib로 분리했다.)
 */
export async function loadApprovedMembership(roomId: string, userId: string) {
  const db = getDb()

  const { data: room, error: roomError } = await db
    .from('study_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle()

  if (roomError) {
    console.error('[group/messages] 방 조회 실패:', roomError)
    return { error: NextResponse.json({ error: '방 정보를 불러오지 못했어요.' }, { status: 500 }) }
  }
  if (!room) {
    return { error: NextResponse.json({ error: '존재하지 않는 방이에요.' }, { status: 404 }) }
  }

  const { data: membership, error: membershipError } = await db
    .from('room_members')
    .select('status')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    console.error('[group/messages] 멤버십 조회 실패:', membershipError)
    return { error: NextResponse.json({ error: '참여 정보를 확인하지 못했어요.' }, { status: 500 }) }
  }
  if (membership?.status !== 'approved') {
    return { error: NextResponse.json({ error: '승인된 회원만 이용할 수 있어요.' }, { status: 403 }) }
  }

  return { room: room as DbStudyRoom }
}
