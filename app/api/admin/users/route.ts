import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { isAdminSession } from '@/lib/auth'
import { getOrderedSubtopicIds } from '@/lib/curriculum'

export async function GET() {
  if (!isAdminSession()) {
    return NextResponse.json({ error: '관리자 로그인이 필요해요.' }, { status: 401 })
  }

  const db = getDb()

  const [{ data: users, error: usersError }, { data: progress, error: progressError }] = await Promise.all([
    db.from('users').select('id, nickname, email, created_at').order('created_at', { ascending: false }),
    db.from('curriculum_progress').select('user_id, level, subtopic_id'),
  ])

  if (usersError || progressError) {
    console.error('[admin/users] fetch failed:', usersError, progressError)
    return NextResponse.json({ error: '회원 목록을 불러오지 못했어요.' }, { status: 500 })
  }

  const totals = {
    beginner: getOrderedSubtopicIds('beginner').length,
    intermediate: getOrderedSubtopicIds('intermediate').length,
    advanced: getOrderedSubtopicIds('advanced').length,
  }

  const progressByUser = new Map<string, Record<string, number>>()
  for (const row of progress ?? []) {
    const entry = progressByUser.get(row.user_id) ?? { beginner: 0, intermediate: 0, advanced: 0 }
    entry[row.level] = (entry[row.level] ?? 0) + 1
    progressByUser.set(row.user_id, entry)
  }

  const result = (users ?? []).map((u) => {
    const done = progressByUser.get(u.id) ?? { beginner: 0, intermediate: 0, advanced: 0 }
    return {
      nickname: u.nickname,
      email: u.email,
      createdAt: u.created_at,
      progress: {
        beginner: `${done.beginner ?? 0} / ${totals.beginner}`,
        intermediate: `${done.intermediate ?? 0} / ${totals.intermediate}`,
        advanced: `${done.advanced ?? 0} / ${totals.advanced}`,
      },
    }
  })

  return NextResponse.json({ users: result })
}
