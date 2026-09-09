import { curriculumLevels, type CurriculumLevel } from '@/data/curriculum'

export function getLevel(levelId: string): CurriculumLevel | undefined {
  return curriculumLevels.find((l) => l.id === levelId)
}

export function getOrderedSubtopicIds(levelId: string): string[] {
  const level = getLevel(levelId)
  if (!level) return []
  return level.modules.flatMap((m) => m.subtopics.map((s) => s.id))
}
