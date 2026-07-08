/**
 * 매주 월요일 실행: 새 강의를 Claude API로 생성해 data/lessons.json에 추가
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=... node scripts/generate-weekly-lesson.mjs
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

function getNextWeekNumber(lessons) {
  if (!lessons.length) return 1
  return Math.max(...lessons.map((l) => l.weekNumber)) + 1
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50)
}

function buildPrompt(weekNumber) {
  return `당신은 초급 AI 교육 콘텐츠 전문가입니다.

Week ${weekNumber}에 해당하는 초급 AI 강의를 JSON 형식으로 생성해주세요.

요구사항:
- 완전한 초보자도 이해할 수 있는 쉬운 언어 사용
- 일상적인 비유와 구체적인 예시 필수
- 5분 이내에 읽을 수 있는 분량 (본문 5단락, 각 2-4문장)
- 강의 주제는 AI/머신러닝/딥러닝 초급 개념 중 선택
- 이미 다룬 기본 주제(AI란, 학습방법, 데이터, ChatGPT원리, 이미지인식, 추천알고리즘, AI편향, NLP, 강화학습, AI활용)와 겹치지 않는 새로운 주제 선택
  예시 주제: AI 윤리, 생성형 AI, 자율주행, 의료 AI, AI와 창의성, 음성 AI, AI와 일자리, 프롬프트 엔지니어링, AI 보안, 엣지 AI 등

반드시 아래 JSON 형식만 반환하세요. 다른 텍스트 없이 JSON만:

{
  "title": "강의 제목",
  "description": "한 줄 설명 (비유나 호기심 자극 포함)",
  "emoji": "이모지 1개",
  "content": [
    "단락1 (일상적 비유로 시작)",
    "단락2 (핵심 개념)",
    "단락3 (구체적 예시)",
    "단락4 (실생활 사례)",
    "단락5 (요약 또는 연결)"
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
  "readTime": "4분"
}`
}

async function main() {
  console.log('📖 기존 강의 데이터 로드 중...')
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const { lessons } = data

  const weekNumber = getNextWeekNumber(lessons)
  console.log(`✨ Week ${weekNumber} 강의 생성 시작...`)

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildPrompt(weekNumber) }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다')

  const generated = JSON.parse(jsonMatch[0])
  console.log(`📝 생성된 강의: "${generated.title}"`)

  const newLesson = {
    id: `lesson-${String(weekNumber).padStart(3, '0')}`,
    slug: `week-${weekNumber}-${slugify(generated.title)}`,
    weekNumber,
    title: generated.title,
    description: generated.description,
    emoji: generated.emoji,
    content: generated.content,
    keyCards: generated.keyCards,
    quiz: generated.quiz,
    readTime: generated.readTime ?? '4분',
    publishedAt: new Date().toISOString(),
    isPublished: true,
  }

  lessons.push(newLesson)
  writeFileSync(DATA_PATH, JSON.stringify({ lessons }, null, 2), 'utf-8')

  console.log(`✅ data/lessons.json에 Week ${weekNumber} 강의 추가 완료!`)
  console.log(`   슬러그: ${newLesson.slug}`)
}

main().catch((err) => {
  console.error('❌ 오류:', err)
  process.exit(1)
})
