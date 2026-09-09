/**
 * 매달 1일 실행: 커리큘럼(초급/중급/고급) 전체를 Claude API로 점검하고
 * 오래되었거나 부정확한 설명·사례를 최신 정보로 업데이트합니다.
 *
 * subtopic id/title/모듈 구조는 절대 바꾸지 않습니다 (사용자 진도 데이터가 id를 참조하기 때문).
 * summary/content/caseExample만 갱신 대상입니다.
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=... node scripts/monthly-review-curriculum.mjs
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CURRICULUM_PATH = join(__dirname, '..', 'data', 'curriculum.ts')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function extractArrayLiteral(src, varName) {
  const marker = `export const ${varName}: CurriculumModule[] = `
  const start = src.indexOf(marker)
  if (start === -1) throw new Error(`Could not find ${varName} in curriculum.ts`)
  const arrStart = start + marker.length
  let depth = 0
  let i = arrStart
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  // eslint-disable-next-line no-eval
  return eval(src.slice(arrStart, i))
}

function buildPrompt(subtopics) {
  return `당신은 AI 교육 콘텐츠 편집자입니다. 아래는 ELAI 커리큘럼의 소제목(subtopic) 목록입니다.

각 항목을 검토해서, 오래되었거나 부정확한 정보가 있으면 최신 정보로 자연스럽게 고쳐주세요. 문제가 없으면 그대로 두어도 됩니다. id와 title은 절대 바꾸지 마세요.

원본 (JSON):
${JSON.stringify(subtopics, null, 2)}

반드시 아래 형식의 JSON 배열만 반환하세요 (원본과 동일한 개수와 순서, 동일한 id). 다른 텍스트는 포함하지 마세요:

[
  {
    "id": "<원본과 동일>",
    "summary": "...",
    "content": ["...", "..."],
    "caseExample": { "title": "...", "scenario": "...", "takeaway": "..." }
  }
]`
}

async function reviewSubtopics(subtopics) {
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    messages: [{ role: 'user', content: buildPrompt(subtopics) }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = rawText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AI 응답에서 JSON 배열을 찾을 수 없습니다')

  const reviewed = JSON.parse(jsonMatch[0])
  const originalIds = new Set(subtopics.map((s) => s.id))
  const reviewedIds = new Set(reviewed.map((r) => r.id))
  if (reviewed.length !== subtopics.length || originalIds.size !== reviewedIds.size) {
    throw new Error('리뷰 결과 id 집합이 원본과 일치하지 않습니다')
  }
  for (const id of originalIds) {
    if (!reviewedIds.has(id)) throw new Error(`리뷰 결과에 id "${id}"가 누락되었습니다`)
  }

  return reviewed
}

async function reviewLevel(modules, levelName) {
  const subtopics = modules.flatMap((m) => m.subtopics)
  console.log(`🔍 ${levelName} (${subtopics.length}개 소주제) 점검 중...`)
  const reviewed = await reviewSubtopics(subtopics)
  const byId = new Map(reviewed.map((r) => [r.id, r]))

  return modules.map((mod) => ({
    ...mod,
    subtopics: mod.subtopics.map((sub) => {
      const update = byId.get(sub.id)
      if (!update) return sub
      return {
        ...sub,
        summary: update.summary ?? sub.summary,
        content: update.content ?? sub.content,
        caseExample: update.caseExample ?? sub.caseExample,
      }
    }),
  }))
}

async function main() {
  const src = readFileSync(CURRICULUM_PATH, 'utf-8')

  const beginnerModules = extractArrayLiteral(src, 'beginnerModules')
  const intermediateModules = extractArrayLiteral(src, 'intermediateModules')
  const advancedModules = extractArrayLiteral(src, 'advancedModules')

  const updatedBeginner = await reviewLevel(beginnerModules, '초급')
  console.log('✅ 초급 점검 완료')
  const updatedIntermediate = await reviewLevel(intermediateModules, '중급')
  console.log('✅ 중급 점검 완료')
  const updatedAdvanced = await reviewLevel(advancedModules, '고급')
  console.log('✅ 고급 점검 완료')

  const output = `export type CurriculumCaseExample = {
  title: string
  scenario: string
  takeaway: string
}

export type CurriculumSubtopic = {
  id: string
  title: string
  summary: string
  content: string[]
  caseExample: CurriculumCaseExample
}

export type CurriculumModule = {
  id: string
  title: string
  subtopics: CurriculumSubtopic[]
}

export type CurriculumLevel = {
  id: 'beginner' | 'intermediate' | 'advanced'
  emoji: string
  label: string
  subtitle: string
  description: string
  modules: CurriculumModule[]
}

export const beginnerModules: CurriculumModule[] = ${JSON.stringify(updatedBeginner, null, 2)}

export const intermediateModules: CurriculumModule[] = ${JSON.stringify(updatedIntermediate, null, 2)}

export const advancedModules: CurriculumModule[] = ${JSON.stringify(updatedAdvanced, null, 2)}

export const curriculumLevels: CurriculumLevel[] = [
  {
    id: 'beginner',
    emoji: '🌱',
    label: '초급',
    subtitle: 'AI 기초 다지기',
    description: 'AI가 처음인 분들을 위한 친절한 입문 과정. 로그인 후 순서대로 하나씩 읽으면 다음 진도가 열려요.',
    modules: beginnerModules,
  },
  {
    id: 'intermediate',
    emoji: '🚀',
    label: '중급',
    subtitle: '머신러닝 실전',
    description: '기초를 넘어 실전 머신러닝에 도전하는 단계',
    modules: intermediateModules,
  },
  {
    id: 'advanced',
    emoji: '⚡',
    label: '고급',
    subtitle: '딥러닝 & LLM 실전',
    description: '최신 LLM과 딥러닝 기술의 최전선',
    modules: advancedModules,
  },
]
`

  writeFileSync(CURRICULUM_PATH, output, 'utf-8')
  console.log('✅ data/curriculum.ts 업데이트 완료')
}

main().catch((err) => {
  console.error('❌ 오류:', err)
  process.exit(1)
})
