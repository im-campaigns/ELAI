import { NextRequest, NextResponse } from 'next/server'
import { getDb, type DbUser } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { sendTempPasswordEmail } from '@/lib/email'
import { ConfigError } from '@/lib/errors'

function generateTempPassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const email = body.email?.trim() ?? ''
  if (!email) {
    return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 })
  }

  try {
    const db = getDb()
    const { data: user } = await db
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle<DbUser>()

    if (!user) {
      return NextResponse.json(
        {
          error:
            '등록되지 않은 이메일입니다. 이메일을 등록하지 않은 회원이라면 관리자에게 문의해주세요.',
        },
        { status: 404 },
      )
    }

    const tempPassword = generateTempPassword()

    // 이메일 발송을 먼저 확인한 뒤 비밀번호를 바꿔, 발송 실패 시 기존 비밀번호가 유지되게 한다.
    await sendTempPasswordEmail(email, tempPassword)

    const password_hash = await hashPassword(tempPassword)
    const { error: updateError } = await db.from('users').update({ password_hash }).eq('id', user.id)

    if (updateError) {
      console.error('[forgot-password] update failed:', updateError)
      return NextResponse.json({ error: '비밀번호 초기화에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[forgot-password] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error('[forgot-password] 알 수 없는 오류:', err)
    return NextResponse.json(
      { error: '임시 비밀번호 발송에 실패했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}
