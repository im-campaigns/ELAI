import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, createUserSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { nickname?: string; password?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const nickname = body.nickname?.trim() ?? ''
  const password = body.password ?? ''
  const email = body.email?.trim() || null

  if (nickname.length < 2 || nickname.length > 20) {
    return NextResponse.json({ error: '닉네임은 2~20자로 입력해주세요.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: '이메일 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const db = getDb()

  const { data: existing } = await db.from('users').select('id').eq('nickname', nickname).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 닉네임이에요.' }, { status: 409 })
  }

  const password_hash = await hashPassword(password)
  const { data: user, error } = await db
    .from('users')
    .insert({ nickname, password_hash, email })
    .select('id')
    .single()

  if (error || !user) {
    console.error('[signup] insert failed:', error)
    return NextResponse.json({ error: '회원가입에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  createUserSession(user.id)
  return NextResponse.json({ ok: true, nickname })
}
