import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getNextWeekNumber } from '@/lib/lessons'

const client = new Anthropic()

const GENERATION_PROMPT = (weekNumber: number) => `당신은 초급 AI 교육 콘텐츠 전문가입니다.

Week ${weekNumber}에 해당하는 초급 AI 강의를 JSON 형식으로 생성해주세요.

요구사항:
- 완전한 초보자도 이해할 수 있는 쉬운 언어 사용
- 일상적인 비유와 구체적인 예시 필수
- 5분 이내에 읽을 수 있는 분량 (본문 5단락, 각 2-4문장)
- 강의 주제는 AI/머신러닝/딥러닝 초급 개념 중 선택
- 이미 다룬 주제와 겹치지 않게 새로운 주제 선택 (예: AI 윤리, 생성형 AI, AI 활용 사례, 자율주행, 의료 AI, AI와 창의성 등)

반드시 아래 JSON 형식만 반환하세요. 다른 텍스트는 절대 포함하지 마세요:

{
  "title": "강의 제목 (한국어, 흥미롭고 명확하게)",
  "description": "한 줄 설명 (한국어, 비유나 호기심을 자극하는 표현 포함)",
  "emoji": "주제에 맞는 이모지 1개",
  "content": [
    "첫 번째 단락 — 일상적인 비유나 상황으로 시작",
    "두 번째 단락 — 핵심 개념 설명",
    "세 번째 단락 — 구체적인 예시나 작동 원리",
    "네 번째 단락 — 실생활 적용 사례",
    "다섯 번째 단락 — 핵심 요약 또는 다음 학습 연결"
  ],
  "keyCards": [
    {
      "emoji": "이모지",
      "title": "핵심 용어 1 (한국어+영어)",
      "content": "2-3문장 설명. 쉽고 명확하게."
    },
    {
      "emoji": "이모지",
      "title": "핵심 용어 2 (한국어+영어)",
      "content": "2-3문장 설명. 쉽고 명확하게."
    },
    {
      "emoji": "이모지",
      "title": "핵심 용어 3 (한국어+영어)",
      "content": "2-3문장 설명. 쉽고 명확하게."
    }
  ],
  "quiz": {
    "question": "강의 내용과 관련된 퀴즈 질문 (한국어)",
    "options": [
      "선택지 A",
      "선택지 B",
      "선택지 C",
      "선택지 D"
    ],
    "correctIndex": 0,
    "explanation": "정답 해설 (친절하고 격려하는 톤으로, 왜 맞는지 설명)"
  },
  "readTime": "4분"
}`

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const weekNumber = body.weekNumber ?? getNextWeekNumber()

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: GENERATION_PROMPT(weekNumber),
        },
      ],
    })

    const rawText =
      message.content[0].type === 'text' ? message.content[0].text : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    const generated = JSON.parse(jsonMatch[0])

    const slug = generated.title
      .toLowerCase()
      .replace(/[^가-힣a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 50)

    const lesson = {
      id: `lesson-${String(weekNumber).padStart(3, '0')}`,
      slug: `week-${weekNumber}-${slug}`,
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

    return NextResponse.json({ lesson })
  } catch (err) {
    console.error('Lesson generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
