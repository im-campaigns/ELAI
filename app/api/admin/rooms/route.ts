import { NextRequest, NextResponse } from 'next/server'
import { getDb, type AiInterest, type AiLevel, type DbRoomMember, type DbStudyRoom } from '@/lib/db'
import { isAdminSession } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'
import { generateAiStudentsForRoom } from '@/lib/aiStudents'

const LEVELS: AiLevel[] = ['beginner', 'intermediate', 'advanced']
const INTERESTS: AiInterest[] = ['업무활용', '공부', '창작', '자유주제']

type MemberWithUser = Pick<DbRoomMember, 'room_id' | 'user_id' | 'status' | 'requested_at'> & {
  users: { nickname: string; job: string | null; ai_level: AiLevel | null; ai_interest: AiInterest | null } | null
}

export async function GET() {
  if (!isAdminSession()) {
    return NextResponse.json({ error: '관리자 로그인이 필요해요.' }, { status: 401 })
  }

  try {
    const db = getDb()
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    const [
      { data: rooms, error: roomsError },
      { data: members, error: membersError },
      { data: usageRows, error: usageError },
    ] = await Promise.all([
      db.from('study_rooms').select('*').order('created_at', { ascending: true }),
      db
        .from('room_members')
        .select('room_id, user_id, status, requested_at, users(nickname, job, ai_level, ai_interest)')
        .order('requested_at', { ascending: true }),
      db.from('ai_usage_log').select('input_tokens, output_tokens').gte('created_at', startOfDay.toISOString()),
    ])

    if (roomsError || membersError) {
      console.error('[admin/rooms GET] fetch failed:', roomsError, membersError)
      return NextResponse.json({ error: '그룹과외 정보를 불러오지 못했어요.' }, { status: 500 })
    }
    if (usageError) {
      console.error('[admin/rooms GET] 토큰 사용량 조회 실패:', usageError)
    }

    const tokensUsedToday = (usageRows ?? []).reduce(
      (sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
      0,
    )
    const dailyTokenBudget = Number(process.env.AI_DAILY_TOKEN_BUDGET)
    const budget =
      Number.isFinite(dailyTokenBudget) && dailyTokenBudget > 0
        ? { used: tokensUsedToday, limit: dailyTokenBudget, exceeded: tokensUsedToday >= dailyTokenBudget }
        : { used: tokensUsedToday, limit: null, exceeded: false }

    const roomList = (rooms ?? []) as DbStudyRoom[]
    const roomNameById = new Map(roomList.map((r) => [r.id, r.name]))

    const approvedCountByRoom = new Map<string, number>()
    const pendingCountByRoom = new Map<string, number>()
    const pending: Array<{
      roomId: string
      userId: string
      roomName: string
      nickname: string
      job: string | null
      level: AiLevel | null
      interest: AiInterest | null
      requestedAt: string
    }> = []

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

    const roomsResult = roomList.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      level: room.level,
      interest: room.interest,
      maxMembers: room.max_members,
      approvedCount: approvedCountByRoom.get(room.id) ?? 0,
      pendingCount: pendingCountByRoom.get(room.id) ?? 0,
    }))

    return NextResponse.json({ rooms: roomsResult, pending, budget })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[admin/rooms GET] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: '관리자 로그인이 필요해요.' }, { status: 401 })
  }

  let body: { name?: string; description?: string; level?: string; interest?: string; maxMembers?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const name = body.name?.trim() ?? ''
  const description = body.description?.trim() ?? ''
  const level = body.level ?? ''
  const interest = body.interest ?? ''
  const maxMembers = Number(body.maxMembers)

  if (!name) {
    return NextResponse.json({ error: '방 이름을 입력해주세요.' }, { status: 400 })
  }
  if (!LEVELS.includes(level as AiLevel)) {
    return NextResponse.json({ error: '수준이 올바르지 않아요.' }, { status: 400 })
  }
  if (!INTERESTS.includes(interest as AiInterest)) {
    return NextResponse.json({ error: '관심분야가 올바르지 않아요.' }, { status: 400 })
  }
  if (!Number.isInteger(maxMembers) || maxMembers < 1) {
    return NextResponse.json({ error: '정원은 1명 이상의 숫자여야 해요.' }, { status: 400 })
  }

  try {
    const db = getDb()
    const { data: inserted, error } = await db
      .from('study_rooms')
      .insert({ name, description, level, interest, max_members: maxMembers })
      .select('id')
      .single()

    if (error || !inserted) {
      console.error('[admin/rooms POST] insert failed:', error)
      return NextResponse.json({ error: '방 생성에 실패했어요.' }, { status: 500 })
    }

    await generateAiStudentsForRoom(db, (inserted as { id: string }).id, level as AiLevel, interest as AiInterest)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[admin/rooms POST] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
