import { randomInt } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminSession, hashPassword } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'

// 혼동하기 쉬운 문자(0/O, 1/l/I 등)를 뺀 안전한 문자셋으로 10자리 무작위 임시 비밀번호를 만든다.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
function generateTempPassword(length = 10): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)]
  }
  return result
}

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
    const tempPassword = generateTempPassword()
    const password_hash = await hashPassword(tempPassword)
    const { data: user, error } = await db
      .from('users')
      .update({ password_hash, must_change_password: true })
      .eq('id', userId)
      .select('nickname')
      .maybeSingle()

    if (error || !user) {
      console.error('[admin/reset-password] update failed:', error)
      return NextResponse.json({ error: '비밀번호 초기화에 실패했어요.' }, { status: 500 })
    }

    // 임시 비밀번호는 이 응답으로 한 번만 전달된다. 서버에는 해시만 남고, 다음 로그인 시
    // must_change_password 플래그로 비밀번호 변경이 강제된다.
    return NextResponse.json({ ok: true, nickname: user.nickname, tempPassword })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[admin/reset-password] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error('[admin/reset-password] 알 수 없는 오류:', err)
    return NextResponse.json({ error: '비밀번호 초기화에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }
}
