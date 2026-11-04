import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'
import { maybeSendWelcome } from '@/lib/roomAi'
import { loadApprovedMembership } from '@/app/api/group/[roomId]/messages/route'

/**
 * 방 입장 시 한 번만 호출되는 전용 엔드포인트. AI쌤의 환영 인사를 생성한다.
 * /messages GET은 폴링마다 반복 호출되므로 읽기 전용으로 유지하고, 환영 인사 생성은
 * 여기로 분리했다. 중복 생성 방지는 maybeSendWelcome 내부의 DB 유니크 제약으로 보장된다.
 */
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  try {
    const { room, error } = await loadApprovedMembership(params.roomId, user.id)
    if (error) return error

    await maybeSendWelcome(room!)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[group/welcome POST] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
