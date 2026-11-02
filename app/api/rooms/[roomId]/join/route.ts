import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth'
import { getDb, type DbStudyRoom } from '@/lib/db'
import { ConfigError } from '@/lib/errors'

export async function POST(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const uid = getSessionUserId()
  if (!uid) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  const roomId = params.roomId
  if (!roomId) {
    return NextResponse.json({ error: '방 정보가 올바르지 않아요.' }, { status: 400 })
  }

  try {
    const db = getDb()

    const { data: room, error: roomError } = await db
      .from('study_rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle()

    if (roomError) {
      console.error('[rooms/join] 방 조회 실패:', roomError)
      return NextResponse.json({ error: '방 정보를 불러오지 못했어요.' }, { status: 500 })
    }
    if (!room) {
      return NextResponse.json({ error: '존재하지 않는 방이에요.' }, { status: 404 })
    }

    const { count: approvedCount, error: countError } = await db
      .from('room_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('status', 'approved')

    if (countError) {
      console.error('[rooms/join] 인원 확인 실패:', countError)
      return NextResponse.json({ error: '방 인원을 확인하지 못했어요.' }, { status: 500 })
    }

    if ((approvedCount ?? 0) >= (room as DbStudyRoom).max_members) {
      return NextResponse.json({ error: '정원이 가득 찬 방이에요.' }, { status: 400 })
    }

    const { error: insertError } = await db
      .from('room_members')
      .insert({ room_id: roomId, user_id: uid, status: 'pending' })

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: '이미 신청한 방이에요.' }, { status: 409 })
      }
      console.error('[rooms/join] 신청 실패:', insertError)
      return NextResponse.json({ error: '참여 신청에 실패했어요.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[rooms/join] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
