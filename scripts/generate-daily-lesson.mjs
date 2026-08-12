/**
 * 평일(월~금) 매일 실행: 새 세부 강의를 Claude API로 생성해 data/lessons.json에 추가
 *
 * Week 단위로 주제를 묶고, 하루에 1개씩(월~금, 5개) 세부 강의를 생성합니다.
 * 금요일이 지나 이번 Week의 5일이 모두 채워지면, 다음 실행 때 새 Week 주제로 넘어갑니다.
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=... node scripts/generate-daily-lesson.mjs
 *
 * GitHub Actions에서는 저장소 Secret(ANTHROPIC_API_KEY)을 환경 변수로 주입합니다.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'lessons.json')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAY_LABELS = ['월', '화', '수', '목', '금']

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50)
}

function getNextSlot(lessons) {
  if (!lessons.length) {
    return { weekNumber: 1, dayIndex: 1, weekTitle: null }
  }
  const sorted = [...lessons].sort(
    (a, b) => a.weekNumber - b.weekNumber || a.dayIndex - b.dayIndex,
  )
  const last = sorted[sorted.length - 1]
  if (last.dayIndex < 5) {
    return { weekNumber: last.weekNumber, dayIndex: last.dayIndex + 1, weekTitle: last.weekTitle }
  }
  return { weekNumber: last.weekNumber + 1, dayIndex: 1, weekTitle: null }
}

function buildPrompt({ weekNumber, dayIndex, weekTitle, lessons }) {
  const isNewWeek = !weekTitle
  const isReviewDay = dayIndex === 5
  const pastWeekTitles = [...new Set(lessons.map((l) => l.weekTitle))]
  const thisWeekLessons = lessons
    .filter((l) => l.weekNumber === weekNumber)
    .map((l) => `${l.lessonNumber} ${l.title}`)

  const weekInstruction = isNewWeek
    ? `이번 Week ${weekNumber}의 새로운 주제를 정하세요. 지금까지 다룬 주제(${
        pastWeekTitles.join(', ') || '없음'
      })와 겹치지 않는 새로운 AI 초급 주제를 골라, 5일(월~금)에 걸쳐 나눠 가르칠 계획을 세우세요. 오늘은 그중 1일차(월요일)이며, 가장 기초적인 정의·개념을 소개하는 날입니다.`
    : `이번 Week ${weekNumber}의 주제는 "${weekTitle}"입니다. 지금까지 이 Week에서 다룬 세부 강의: ${thisWeekLessons.join(
        ', ',
      )}. 오늘은 ${dayIndex}일차(${DAY_LABELS[dayIndex - 1]}요일)입니다. ${
        isReviewDay
          ? '이번 주 배운 세부 강의들을 종합해서 정리하고, 퀴즈로 복습하는 날입니다. 제목은 "퀴즈 & 정리"로 하세요.'
          : '이 주제를 이어가는 새로운 세부 개념 하나를 다루는 날입니다. 앞서 다룬 세부 강의와 절대 겹치지 않게 하세요.'
      }`

  return `당신은 초급 AI 교육 콘텐츠 전문가입니다.

${weekInstruction}

요구사항:
- 완전한 초보자도 이해할 수 있는 쉬운 언어 사용
- 5분 이내에 읽을 수 있는 짧고 임팩트 있는 분량 (본문 3단락, 각 2-3문장)
- 일상적인 비유와 구체적인 예시 필수
- 오늘의 세부 주제 하나에만 집중하고, 전체 개념을 다 담으려 하지 마세요

반드시 아래 JSON 형식만 반환하세요. 다른 텍스트 없이 JSON만:

{${isNewWeek ? '\n  "weekTitle": "이번 주 전체를 아우르는 주제 (예: AI란 무엇인가?)",' : ''}
  "title": "오늘 세부 강의 제목 (예: AI의 정의)",
  "description": "한 줄 설명 (비유나 호기심 자극 포함)",
  "emoji": "이모지 1개",
  "content": [
    "단락1 (일상적 비유로 시작)",
    "단락2 (핵심 개념)",
    "단락3 (예시 또는 요약)"
  ],
  "keyCards": [
    { "emoji": "이모지", "title": "용어1", "content": "설명" },
    { "emoji": "이모지", "title": "용어2", "content": "설명" },
    { "emoji": "이모지", "title": "용어3", "content": "설명" }
  ],
  "quiz": {
    "question": "퀴즈 질문",
    "options": ["선택지A", "선택지B", "선택지C", "선택지D"],
    "correctIndex": 0,
    "explanation": "정답 해설"
  },
  "readTime": "3분"
}`
}

async function main() {
  console.log('📖 기존 강의 데이터 로드 중...')
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const { lessons } = data

  const slot = getNextSlot(lessons)
  const dayLabel = DAY_LABELS[slot.dayIndex - 1]
  console.log(`✨ Week ${slot.weekNumber} · ${slot.dayIndex}일차(${dayLabel}) 강의 생성 시작...`)

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildPrompt({ ...slot, lessons }) }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다')

  const generated = JSON.parse(jsonMatch[0])
  const weekTitle = slot.weekTitle ?? generated.weekTitle
  if (!weekTitle) throw new Error('weekTitle을 결정할 수 없습니다')

  console.log(`📝 생성된 강의: Week ${slot.weekNumber} "${weekTitle}" - ${generated.title}`)

  const newLesson = {
    id: `w${slot.weekNumber}d${slot.dayIndex}`,
    slug: `week-${slot.weekNumber}-${slot.dayIndex}-${slugify(generated.title)}`,
    weekNumber: slot.weekNumber,
    weekTitle,
    dayIndex: slot.dayIndex,
    dayLabel,
    lessonNumber: `${slot.weekNumber}-${slot.dayIndex}`,
    title: generated.title,
    description: generated.description,
    emoji: generated.emoji,
    content: generated.content,
    keyCards: generated.keyCards,
    quiz: generated.quiz,
    readTime: generated.readTime ?? '3분',
    publishedAt: new Date().toISOString(),
    isPublished: true,
  }

  lessons.push(newLesson)
  writeFileSync(DATA_PATH, JSON.stringify({ lessons }, null, 2), 'utf-8')

  console.log(`✅ data/lessons.json에 ${newLesson.lessonNumber} 강의 추가 완료!`)
  console.log(`   슬러그: ${newLesson.slug}`)
}

main().catch((err) => {
  console.error('❌ 오류:', err)
  process.exit(1)
})
