import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiInterest, AiLevel } from '@/lib/db'
import { AI_STUDENT_TEMPLATES } from '@/lib/aiStudentData'

const MIN_STUDENTS_PER_ROOM = 1
const MAX_STUDENTS_PER_ROOM = 3

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function randomCount(available: number): number {
  const upper = Math.min(MAX_STUDENTS_PER_ROOM, available)
  if (upper <= 0) return 0
  if (upper <= MIN_STUDENTS_PER_ROOM) return upper
  return MIN_STUDENTS_PER_ROOM + Math.floor(Math.random() * (upper - MIN_STUDENTS_PER_ROOM + 1))
}

/**
 * 방이 새로 만들어질 때 AI 학생을 1~3명 자동 생성한다.
 * 닉네임은 ai_students 테이블 전체에서 겹치면 안 되므로, 이미 쓰인 닉네임을 DB에서 조회해
 * 제외한 뒤 방의 수준/관심분야와 맞는 후보를 우선으로 무작위 선택한다.
 */
export async function generateAiStudentsForRoom(
  db: SupabaseClient,
  roomId: string,
  level: AiLevel,
  interest: AiInterest,
): Promise<void> {
  const { data: existing, error } = await db.from('ai_students').select('nickname')
  if (error) {
    console.error('[aiStudents] 기존 닉네임 조회 실패:', error)
    return
  }
  const usedNicknames = new Set((existing ?? []).map((row) => row.nickname as string))
  const available = AI_STUDENT_TEMPLATES.filter((t) => !usedNicknames.has(t.nickname))

  const exactMatch = available.filter((t) => t.level === level && t.interest === interest)
  const levelMatch = available.filter((t) => t.level === level && t.interest !== interest)
  const rest = available.filter((t) => t.level !== level)

  const pool = [...shuffle(exactMatch), ...shuffle(levelMatch), ...shuffle(rest)]
  const count = randomCount(pool.length)
  if (count === 0) return

  const rows = pool.slice(0, count).map((t) => ({
    room_id: roomId,
    nickname: t.nickname,
    persona: t.persona,
  }))

  const { error: insertError } = await db.from('ai_students').insert(rows)
  if (insertError) {
    console.error('[aiStudents] AI 학생 생성 실패:', insertError)
  }
}
