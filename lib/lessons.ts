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

export type Lesson = {
  id: string
  slug: string
  weekNumber: number
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

export function getAllLessons(): Lesson[] {
  return (lessonsData.lessons as Lesson[])
    .filter((l) => l.isPublished)
    .sort((a, b) => a.weekNumber - b.weekNumber)
}

export function getLessonBySlug(slug: string): Lesson | undefined {
  return (lessonsData.lessons as Lesson[]).find(
    (l) => l.slug === slug && l.isPublished,
  )
}

export function getAdjacentLessons(slug: string): {
  prev: Lesson | null
  next: Lesson | null
} {
  const lessons = getAllLessons()
  const idx = lessons.findIndex((l) => l.slug === slug)
  return {
    prev: idx > 0 ? lessons[idx - 1] : null,
    next: idx < lessons.length - 1 ? lessons[idx + 1] : null,
  }
}

export function formatPublishedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function getNextWeekNumber(): number {
  const lessons = lessonsData.lessons as Lesson[]
  if (lessons.length === 0) return 1
  return Math.max(...lessons.map((l) => l.weekNumber)) + 1
}
