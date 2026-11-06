import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminSession } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'

export async function PATCH(req: NextRequest, { params }: { params: { studentId: string } }) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: '관리자 로그인이 필요해요.' }, { status: 401 })
  }

  let body: { isActive?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive 값이 필요해요.' }, { status: 400 })
  }

  try {
    const { error } = await getDb()
      .from('ai_students')
      .update({ is_active: body.isActive })
      .eq('id', params.studentId)

    if (error) {
      console.error('[admin/ai-students PATCH] update failed:', error)
      return NextResponse.json({ error: '변경에 실패했어요.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[admin/ai-students PATCH] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
