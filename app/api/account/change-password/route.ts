import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const currentPassword = body.currentPassword ?? ''
  const newPassword = body.newPassword ?? ''

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: '새 비밀번호는 6자 이상이어야 해요.' }, { status: 400 })
  }

  try {
    const db = getDb()

    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않아요.' }, { status: 401 })
    }

    const password_hash = await hashPassword(newPassword)
    const { error } = await db.from('users').update({ password_hash }).eq('id', user.id)

    if (error) {
      console.error('[account/change-password] update failed:', error)
      return NextResponse.json({ error: '비밀번호 변경에 실패했어요.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[account/change-password] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error('[account/change-password] 알 수 없는 오류:', err)
    return NextResponse.json({ error: '비밀번호 변경에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }
}
