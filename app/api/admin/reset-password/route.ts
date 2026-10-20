import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminSession, hashPassword } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'

const TEMP_PASSWORD = '1234'

export async function POST(req: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: '관리자 로그인이 필요해요.' }, { status: 401 })
  }

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const userId = body.userId?.trim() ?? ''
  if (!userId) {
    return NextResponse.json({ error: '회원 정보가 올바르지 않아요.' }, { status: 400 })
  }

  try {
    const db = getDb()
    const password_hash = await hashPassword(TEMP_PASSWORD)
    const { data: user, error } = await db
      .from('users')
      .update({ password_hash })
      .eq('id', userId)
      .select('nickname')
      .maybeSingle()

    if (error || !user) {
      console.error('[admin/reset-password] update failed:', error)
      return NextResponse.json({ error: '비밀번호 초기화에 실패했어요.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, nickname: user.nickname, tempPassword: TEMP_PASSWORD })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[admin/reset-password] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error('[admin/reset-password] 알 수 없는 오류:', err)
    return NextResponse.json({ error: '비밀번호 초기화에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }
}
