import { NextResponse } from 'next/server'
import { getDb, type DbRoomMessage } from '@/lib/db'
import { isAdminSession } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'

export async function GET(_req: Request, { params }: { params: { roomId: string } }) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: '관리자 로그인이 필요해요.' }, { status: 401 })
  }

  try {
    const { data, error } = await getDb()
      .from('room_messages')
      .select('id, user_id, sender_type, nickname, content, created_at')
      .eq('room_id', params.roomId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[admin/rooms/messages] 조회 실패:', error)
      return NextResponse.json({ error: '대화를 불러오지 못했어요.' }, { status: 500 })
    }

    const messages = ((data ?? []) as DbRoomMessage[])
      .slice()
      .reverse()
      .map((m) => ({
        id: m.id,
        senderType: m.sender_type,
        nickname: m.nickname,
        content: m.content,
        createdAt: m.created_at,
      }))

    return NextResponse.json({ messages })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[admin/rooms/messages] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
