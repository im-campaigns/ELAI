import { NextRequest, NextResponse } from 'next/server'
import { getDb, type DbUser } from '@/lib/db'
import { verifyPassword, createUserSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { nickname?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const nickname = body.nickname?.trim() ?? ''
  const password = body.password ?? ''

  if (!nickname || !password) {
    return NextResponse.json({ error: '닉네임과 비밀번호를 모두 입력해주세요.' }, { status: 400 })
  }

  const db = getDb()
  const { data: user } = await db
    .from('users')
    .select('*')
    .eq('nickname', nickname)
    .maybeSingle<DbUser>()

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: '닉네임 또는 비밀번호가 올바르지 않아요.' }, { status: 401 })
  }

  createUserSession(user.id)
  return NextResponse.json({ ok: true, nickname: user.nickname })
}
