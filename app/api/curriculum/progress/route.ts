import { NextRequest, NextResponse } from 'next/server'
import { getDb, type DbProgress } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { getOrderedSubtopicIds } from '@/lib/curriculum'
import { ConfigError } from '@/lib/errors'

export async function GET() {
  const uid = getSessionUserId()
  if (!uid) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  try {
    const { data, error } = await getDb()
      .from('curriculum_progress')
      .select('level, subtopic_id')
      .eq('user_id', uid)

    if (error) {
      console.error('[curriculum/progress GET] failed:', error)
      return NextResponse.json({ error: '진도 정보를 불러오지 못했어요.' }, { status: 500 })
    }

    const progress: Record<string, string[]> = { beginner: [], intermediate: [], advanced: [] }
    for (const row of (data ?? []) as Pick<DbProgress, 'level' | 'subtopic_id'>[]) {
      progress[row.level]?.push(row.subtopic_id)
    }

    return NextResponse.json({ progress })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[curriculum/progress GET] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const uid = getSessionUserId()
  if (!uid) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  let body: { level?: string; subtopicId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  const { level, subtopicId } = body
  if (!level || !subtopicId) {
    return NextResponse.json({ error: 'level과 subtopicId가 필요해요.' }, { status: 400 })
  }

  const orderedIds = getOrderedSubtopicIds(level)
  const targetIndex = orderedIds.indexOf(subtopicId)
  if (targetIndex === -1) {
    return NextResponse.json({ error: '존재하지 않는 주제예요.' }, { status: 404 })
  }

  try {
    const db = getDb()
    const { data: completedRows, error: fetchError } = await db
      .from('curriculum_progress')
      .select('subtopic_id')
      .eq('user_id', uid)
      .eq('level', level)

    if (fetchError) {
      console.error('[curriculum/progress POST] fetch failed:', fetchError)
      return NextResponse.json({ error: '진도 확인에 실패했어요.' }, { status: 500 })
    }

    const completedSet = new Set((completedRows ?? []).map((r) => r.subtopic_id))
    const isUnlocked = targetIndex === 0 || completedSet.has(orderedIds[targetIndex - 1])
    if (!isUnlocked) {
      return NextResponse.json({ error: '이전 주제를 먼저 읽어야 열려요.' }, { status: 403 })
    }

    const { error: upsertError } = await db
      .from('curriculum_progress')
      .upsert({ user_id: uid, level, subtopic_id: subtopicId }, { onConflict: 'user_id,level,subtopic_id' })

    if (upsertError) {
      console.error('[curriculum/progress POST] upsert failed:', upsertError)
      return NextResponse.json({ error: '진도 저장에 실패했어요.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[curriculum/progress POST] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
