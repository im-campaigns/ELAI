import { NextRequest, NextResponse } from 'next/server'
import { createAdminSession } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'

const ADMIN_ID = 'admin'

export async function POST(req: NextRequest) {
  let body: { id?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const adminPassword = process.env.ADMIN_PASSWORD ?? '0909'

  if (body.id !== ADMIN_ID || body.password !== adminPassword) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않아요.' }, { status: 401 })
  }

  try {
    createAdminSession()
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[admin/login] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
  return NextResponse.json({ ok: true })
}
