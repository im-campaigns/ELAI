import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDb, type DbRoomMessage, type DbStudyRoom } from '@/lib/db'
import { ConfigError } from '@/lib/errors'
import { maybeReplyToMember, maybeTriggerAiStudent, shouldAiReply } from '@/lib/roomAi'

const MAX_CONTENT_LENGTH = 500
const MIN_RESEND_INTERVAL_MS = 2000

function formatMessage(m: DbRoomMessage) {
  return {
    id: m.id,
    userId: m.user_id,
    senderType: m.sender_type,
    nickname: m.nickname,
    content: m.content,
    createdAt: m.created_at,
    visibleAt: m.visible_at,
  }
}

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

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  try {
    const { room, error } = await loadApprovedMembership(params.roomId, user.id)
    if (error) return error

    const after = req.nextUrl.searchParams.get('after')
    const db = getDb()
    const nowIso = new Date().toISOString()

    if (after) {
      const afterDate = new Date(after)
      if (Number.isNaN(afterDate.getTime())) {
        return NextResponse.json({ error: '시간 형식이 올바르지 않아요.' }, { status: 400 })
      }

      const { data, error: queryError } = await db
        .from('room_messages')
        .select('id, room_id, user_id, sender_type, nickname, content, created_at, visible_at')
        .eq('room_id', room!.id)
        .gt('visible_at', afterDate.toISOString())
        .lte('visible_at', nowIso)
        .order('visible_at', { ascending: true })
        .limit(50)

      if (queryError) {
        console.error('[group/messages] 조회 실패:', queryError)
        return NextResponse.json({ error: '메시지를 불러오지 못했어요.' }, { status: 500 })
      }

      return NextResponse.json({ messages: ((data ?? []) as DbRoomMessage[]).map(formatMessage) })
    }

    const { data, error: queryError } = await db
      .from('room_messages')
      .select('id, room_id, user_id, sender_type, nickname, content, created_at, visible_at')
      .eq('room_id', room!.id)
      .lte('visible_at', nowIso)
      .order('visible_at', { ascending: false })
      .limit(50)

    if (queryError) {
      console.error('[group/messages] 조회 실패:', queryError)
      return NextResponse.json({ error: '메시지를 불러오지 못했어요.' }, { status: 500 })
    }

    const messages = ((data ?? []) as DbRoomMessage[]).slice().reverse().map(formatMessage)
    return NextResponse.json({ messages })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[group/messages GET] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const content = body.content?.trim() ?? ''
  if (content.length < 1 || content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: `메시지는 1~${MAX_CONTENT_LENGTH}자로 입력해주세요.` }, { status: 400 })
  }

  try {
    const { room, error } = await loadApprovedMembership(params.roomId, user.id)
    if (error) return error

    const db = getDb()

    const { data: lastOwn, error: lastOwnError } = await db
      .from('room_messages')
      .select('created_at')
      .eq('room_id', room!.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastOwnError) {
      console.error('[group/messages POST] 최근 메시지 조회 실패:', lastOwnError)
      return NextResponse.json({ error: '메시지를 보내지 못했어요.' }, { status: 500 })
    }

    if (lastOwn && Date.now() - new Date(lastOwn.created_at).getTime() < MIN_RESEND_INTERVAL_MS) {
      return NextResponse.json({ error: '너무 빠르게 보내고 있어요. 잠시 후 다시 시도해주세요.' }, { status: 429 })
    }

    const { data: inserted, error: insertError } = await db
      .from('room_messages')
      .insert({ room_id: room!.id, user_id: user.id, sender_type: 'member', nickname: user.nickname, content })
      .select('id, room_id, user_id, sender_type, nickname, content, created_at, visible_at')
      .single()

    if (insertError || !inserted) {
      console.error('[group/messages POST] 저장 실패:', insertError)
      return NextResponse.json({ error: '메시지를 보내지 못했어요.' }, { status: 500 })
    }

    // AI쌤 메시지(sender_type='ai_teacher')는 답변 트리거가 될 수 없다. 이 POST는
    // 항상 sender_type='member'로만 메시지를 저장하므로 아래 조건으로 다시 한 번 보장한다.
    // AI쌤이 답할 질문이면 같은 메시지에 AI 학생이 끼지 않아, 회원 메시지 1개당
    // AI 응답(AI쌤 또는 AI 학생 중 하나)이 최대 1개로 자연스럽게 유지된다.
    const insertedMessage = inserted as DbRoomMessage
    if (insertedMessage.sender_type === 'member') {
      if (shouldAiReply(content)) {
        await maybeReplyToMember(room!, { nickname: user.nickname, content })
      } else {
        await maybeTriggerAiStudent(room!, { id: insertedMessage.id, nickname: user.nickname, content })
      }
    }

    return NextResponse.json({ message: formatMessage(insertedMessage) })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[group/messages POST] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
