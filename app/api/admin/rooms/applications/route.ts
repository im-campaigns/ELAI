import { NextRequest, NextResponse } from 'next/server'
import { getDb, type DbStudyRoom } from '@/lib/db'
import { isAdminSession } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'

export async function POST(req: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: '관리자 로그인이 필요해요.' }, { status: 401 })
  }

  let body: { roomId?: string; userId?: string; decision?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const roomId = body.roomId?.trim() ?? ''
  const userId = body.userId?.trim() ?? ''
  const decision = body.decision

  if (!roomId || !userId) {
    return NextResponse.json({ error: '신청 정보가 올바르지 않아요.' }, { status: 400 })
  }
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: '승인 또는 거절만 가능해요.' }, { status: 400 })
  }

  try {
    const db = getDb()

    const { data: membership, error: membershipError } = await db
      .from('room_members')
      .select('room_id, user_id, status')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) {
      console.error('[admin/rooms/applications] 조회 실패:', membershipError)
      return NextResponse.json({ error: '신청 정보를 확인하지 못했어요.' }, { status: 500 })
    }
    if (!membership || membership.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 신청이에요.' }, { status: 409 })
    }

    if (decision === 'approved') {
      const { data: room, error: roomError } = await db
        .from('study_rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle()

      if (roomError || !room) {
        console.error('[admin/rooms/applications] 방 조회 실패:', roomError)
        return NextResponse.json({ error: '방 정보를 불러오지 못했어요.' }, { status: 500 })
      }

      const { count: approvedCount, error: countError } = await db
        .from('room_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('status', 'approved')

      if (countError) {
        console.error('[admin/rooms/applications] 인원 확인 실패:', countError)
        return NextResponse.json({ error: '방 인원을 확인하지 못했어요.' }, { status: 500 })
      }

      if ((approvedCount ?? 0) >= (room as DbStudyRoom).max_members) {
        return NextResponse.json({ error: '정원이 가득 차서 승인할 수 없어요.' }, { status: 400 })
      }
    }

    const { error: updateError } = await db
      .from('room_members')
      .update({ status: decision, decided_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (updateError) {
      console.error('[admin/rooms/applications] 업데이트 실패:', updateError)
      return NextResponse.json({ error: '처리에 실패했어요.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[admin/rooms/applications] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
