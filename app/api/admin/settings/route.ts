import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminSession } from '@/lib/auth'
import { ConfigError } from '@/lib/errors'
import { PRICE_KEYS } from '@/lib/adminStats'

/** 관리자 대시보드의 모델 단가(예상 비용 계산용)를 저장한다. */
export async function POST(req: NextRequest) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: '관리자 로그인이 필요해요.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const rows: Array<{ key: string; value: number; updated_at: string }> = []
  for (const key of PRICE_KEYS) {
    const raw = body[key]
    if (raw === undefined || raw === null || raw === '') continue
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
      return NextResponse.json({ error: '단가는 0 이상의 숫자로 입력해주세요.' }, { status: 400 })
    }
    rows.push({ key, value, updated_at: new Date().toISOString() })
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: '저장할 값이 없어요.' }, { status: 400 })
  }

  try {
    const { error } = await getDb().from('admin_settings').upsert(rows, { onConflict: 'key' })
    if (error) {
      console.error('[admin/settings] 저장 실패:', error)
      return NextResponse.json(
        { error: '저장하지 못했어요. SQL 3-9를 먼저 실행했는지 확인해주세요.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) return NextResponse.json({ error: err.message }, { status: 503 })
    throw err
  }
}
