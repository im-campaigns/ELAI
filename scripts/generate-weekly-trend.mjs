/**
 * 매주 월요일 실행: 최신 AI 트렌드 글을 Claude API로 생성해 data/posts.json에 추가
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=... node scripts/generate-weekly-trend.mjs
 *
 * GitHub Actions에서는 저장소 Secret(ANTHROPIC_API_KEY)을 환경 변수로 주입합니다.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'posts.json')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ACCENT_PAIRS = [
  ['from-primary-500', 'to-indigo-600'],
  ['from-accent-500', 'to-pink-600'],
  ['from-secondary-500', 'to-emerald-600'],
  ['from-indigo-500', 'to-primary-600'],
  ['from-slate-700', 'to-slate-900'],
]

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60)
}

function buildPrompt(existingTitles) {
  return `당신은 AI 업계 트렌드를 다루는 전문 에디터입니다.

ELAI 사이트의 "트렌드" 코너에 올릴 새로운 글 1개를 작성하세요. 카테고리는 "trend"(최신 AI 기술/산업 동향)로 고정합니다.
지금까지 다룬 제목(${existingTitles.length ? existingTitles.join(', ') : '없음'})과 겹치지 않는 참신한 주제를 고르세요.

요구사항:
- 일반 대중도 이해할 수 있는 쉬운 언어로 작성
- 4~5개 문단, 각 문단 2~4문장
- 최신 AI 트렌드/기술/산업 동향 중 흥미로운 주제 하나
- 반드시 도표(chart)에 들어갈 비교/정리 데이터 포함

반드시 아래 JSON 형식만 반환하세요. 다른 텍스트 없이 JSON만:

{
  "title": "글 제목 (한국어, 흥미롭고 명확하게)",
  "excerpt": "한 줄 요약 (한국어, 호기심을 자극하는 표현)",
  "emoji": "주제에 맞는 이모지 1개",
  "readTime": "6분",
  "content": ["단락1", "단락2", "단락3", "단락4"],
  "chart": {
    "title": "도표 제목",
    "rows": [
      { "label": "항목1", "value": "설명1" },
      { "label": "항목2", "value": "설명2" },
      { "label": "항목3", "value": "설명3" }
    ]
  }
}`
}

async function main() {
  console.log('📖 기존 트렌드 글 로드 중...')
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const { posts } = data
  const existingTitles = posts.map((p) => p.title)

  console.log('✨ 새 트렌드 글 생성 시작...')
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildPrompt(existingTitles) }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다')

  const generated = JSON.parse(jsonMatch[0])
  if (!generated.title || !Array.isArray(generated.content) || generated.content.length === 0) {
    throw new Error('AI 응답에 필수 필드가 누락되었습니다')
  }

  const [accentFrom, accentTo] = ACCENT_PAIRS[posts.length % ACCENT_PAIRS.length]

  const newPost = {
    id: `post-${String(posts.length + 1).padStart(3, '0')}`,
    slug: slugify(generated.title),
    category: 'trend',
    title: generated.title,
    excerpt: generated.excerpt,
    emoji: generated.emoji ?? '📰',
    mediaType: 'image',
    accentFrom,
    accentTo,
    readTime: generated.readTime ?? '5분',
    publishedAt: new Date().toISOString(),
    content: generated.content,
    ...(generated.chart ? { chart: generated.chart } : {}),
  }

  posts.push(newPost)
  writeFileSync(DATA_PATH, JSON.stringify({ posts }, null, 2), 'utf-8')

  console.log(`✅ data/posts.json에 새 트렌드 글 추가 완료: ${newPost.title}`)
  console.log(`   슬러그: ${newPost.slug}`)
}

main().catch((err) => {
  console.error('❌ 오류:', err)
  process.exit(1)
})
