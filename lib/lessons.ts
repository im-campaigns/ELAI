import lessonsData from '@/data/lessons.json'

export type KeyCard = {
  emoji: string
  title: string
  content: string
}

export type Quiz = {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export const DAY_LABELS = ['월', '화', '수', '목', '금'] as const

export type Lesson = {
  id: string
  slug: string
  weekNumber: number
  weekTitle: string
  dayIndex: number // 1~5 (월~금)
  dayLabel: string
  lessonNumber: string // e.g. "1-1"
  title: string
  description: string
  emoji: string
  content: string[]
  keyCards: KeyCard[]
  quiz: Quiz
  readTime: string
  publishedAt: string
  isPublished: boolean
}

export type Week = {
  weekNumber: number
  weekTitle: string
  lessons: Lesson[]
}

function sortLessons(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort(
    (a, b) => a.weekNumber - b.weekNumber || a.dayIndex - b.dayIndex,
  )
}

export function getAllLessons(): Lesson[] {
  return sortLessons(
    (lessonsData.lessons as Lesson[]).filter((l) => l.isPublished),
  )
}

export function getLessonsByWeek(): Week[] {
  const lessons = getAllLessons()
  const weeks = new Map<number, Week>()

  for (const lesson of lessons) {
    let week = weeks.get(lesson.weekNumber)
    if (!week) {
      week = { weekNumber: lesson.weekNumber, weekTitle: lesson.weekTitle, lessons: [] }
      weeks.set(lesson.weekNumber, week)
    }
    week.lessons.push(lesson)
  }

  return Array.from(weeks.values()).sort((a, b) => a.weekNumber - b.weekNumber)
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

export function getLessonBySlug(slug: string): Lesson | undefined {
  const decoded = decodeSlug(slug)
  return (lessonsData.lessons as Lesson[]).find(
    (l) => l.slug === decoded && l.isPublished,
  )
}

export function getAdjacentLessons(slug: string): {
  prev: Lesson | null
  next: Lesson | null
} {
  const decoded = decodeSlug(slug)
  const lessons = getAllLessons()
  const idx = lessons.findIndex((l) => l.slug === decoded)
  return {
    prev: idx > 0 ? lessons[idx - 1] : null,
    next: idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null,
  }
}

export function formatPublishedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Determines the next lesson slot to generate. If the current week's 5 days
 * (월~금) are complete, moves to a new week (weekTitle left null so the
 * caller/AI must pick a new topic). Otherwise continues the current week.
 */
export function getNextSlot(): {
  weekNumber: number
  dayIndex: number
  dayLabel: string
  weekTitle: string | null
} {
  const lessons = sortLessons(lessonsData.lessons as Lesson[])
  if (lessons.length === 0) {
    return { weekNumber: 1, dayIndex: 1, dayLabel: DAY_LABELS[0], weekTitle: null }
  }

  const last = lessons[lessons.length - 1]
  if (last.dayIndex < 5) {
    return {
      weekNumber: last.weekNumber,
      dayIndex: last.dayIndex + 1,
      dayLabel: DAY_LABELS[last.dayIndex],
      weekTitle: last.weekTitle,
    }
  }

  return {
    weekNumber: last.weekNumber + 1,
    dayIndex: 1,
    dayLabel: DAY_LABELS[0],
    weekTitle: null,
  }
}
