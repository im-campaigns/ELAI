import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getCurrentUser } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'
import { loadApprovedMembership } from '../messages/route'

// Supabase Realtime 접근을 위한 단기 토큰. 이 앱은 Supabase Auth를 쓰지 않으므로,
// 서버가 "승인된 멤버십"을 직접 확인한 뒤 해당 room_id만 읽을 수 있는 토큰을 발급한다.
// RLS 정책(supabase/3-5-realtime-rls.sql)이 이 토큰의 room_id 클레임을 검사하므로,
// 승인되지 않은 방의 메시지는 이 토큰으로도 읽을 수 없다.
const TOKEN_TTL_SECONDS = 5 * 60

export async function POST(_req: Request, { params }: { params: { roomId: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  try {
    const { room, error } = await loadApprovedMembership(params.roomId, user.id)
    if (error) return error

    const secret = process.env.SUPABASE_JWT_SECRET
    if (!secret) {
      console.error('[realtime-token] SUPABASE_JWT_SECRET이 설정되어 있지 않습니다.')
      return NextResponse.json({ error: 'Realtime이 아직 설정되지 않았어요.' }, { status: 503 })
    }

    const token = jwt.sign({ role: 'authenticated', room_id: room!.id, sub: user.id }, secret, {
      algorithm: 'HS256',
      expiresIn: TOKEN_TTL_SECONDS,
    })

    return NextResponse.json({ token, expiresIn: TOKEN_TTL_SECONDS })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[realtime-token] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
