/**
 * 매달 1일 실행: AI 상식 20강(Week 1~4) 전체를 Claude API로 점검하고
 * 오래되었거나 부정확한 내용을 최신 정보로 업데이트합니다.
 *
 * 제목/슬러그/강의 번호 등 식별 정보는 절대 바꾸지 않고,
 * content/keyCards/chart/visual/quiz 같은 실제 학습 콘텐츠만 갱신 대상입니다.
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=... node scripts/monthly-review-lessons.mjs
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'lessons.json')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EDITABLE_FIELDS = ['description', 'content', 'keyCards', 'chart', 'visual', 'quiz', 'readTime']

function buildPrompt(weekLessons) {
  return `당신은 AI 초급 교육 콘텐츠 편집자입니다. 아래는 ELAI "AI 상식" 코스의 한 주(5강) 콘텐츠입니다.

각 강의를 검토해서, 오래되었거나 부정확한 정보(예: 특정 연도 통계, 더 이상 최신이 아닌 사례, 사라진 서비스명 등)가 있으면 최신 정보로 자연스럽게 고쳐주세요. 문제가 없다면 그대로 두어도 됩니다. 절대로 title, dayIndex, emoji는 바꾸지 마세요.

원본 강의 (JSON):
${JSON.stringify(weekLessons, null, 2)}

반드시 아래 형식의 JSON 배열만 반환하세요 (강의 5개, 원본과 같은 순서). 다른 텍스트는 포함하지 마세요:

[
  {
    "dayIndex": <원본과 동일>,
    "description": "...",
    "content": ["...", "...", "..."],
    "keyCards": [{ "emoji": "...", "title": "...", "content": "..." }, ...],
    "chart": { "title": "...", "rows": [{ "label": "...", "value": "..." }, ...] },
    "visual": { "caption": "...", "points": ["...", "...", "..."] },
    "quiz": { "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." },
    "readTime": "3분"
  }
]`
}

async function reviewWeek(weekLessons) {
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    messages: [{ role: 'user', content: buildPrompt(weekLessons) }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = rawText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AI 응답에서 JSON 배열을 찾을 수 없습니다')

  const reviewed = JSON.parse(jsonMatch[0])
  if (!Array.isArray(reviewed) || reviewed.length !== weekLessons.length) {
    throw new Error(`리뷰 결과 개수가 원본(${weekLessons.length})과 다릅니다: ${reviewed?.length}`)
  }

  return weekLessons.map((original) => {
    const update = reviewed.find((r) => r.dayIndex === original.dayIndex)
    if (!update) throw new Error(`dayIndex ${original.dayIndex}에 대한 업데이트를 찾을 수 없습니다`)

    const merged = { ...original }
    for (const field of EDITABLE_FIELDS) {
      if (update[field] !== undefined) merged[field] = update[field]
    }
    return merged
  })
}

async function main() {
  console.log('📖 기존 강의 데이터 로드 중...')
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const { lessons } = data

  const weekNumbers = [...new Set(lessons.map((l) => l.weekNumber))].sort((a, b) => a - b)
  const updatedLessons = []

  for (const weekNumber of weekNumbers) {
    const weekLessons = lessons
      .filter((l) => l.weekNumber === weekNumber)
      .sort((a, b) => a.dayIndex - b.dayIndex)

    console.log(`🔍 Week ${weekNumber} 점검 중...`)
    const reviewed = await reviewWeek(weekLessons)
    updatedLessons.push(...reviewed)
    console.log(`✅ Week ${weekNumber} 점검 완료`)
  }

  updatedLessons.sort((a, b) => a.weekNumber - b.weekNumber || a.dayIndex - b.dayIndex)
  writeFileSync(DATA_PATH, JSON.stringify({ lessons: updatedLessons }, null, 2), 'utf-8')
  console.log(`✅ data/lessons.json 업데이트 완료 (총 ${updatedLessons.length}개 강의)`)
}

main().catch((err) => {
  console.error('❌ 오류:', err)
  process.exit(1)
})
