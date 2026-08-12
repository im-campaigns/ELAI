import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getNextSlot } from '@/lib/lessons'

const client = new Anthropic()

const DAY_LABELS = ['월', '화', '수', '목', '금']

function buildPrompt(
  weekNumber: number,
  dayIndex: number,
  weekTitle: string | null,
) {
  const isNewWeek = !weekTitle
  const isReviewDay = dayIndex === 5

  const weekInstruction = isNewWeek
    ? `이번 Week ${weekNumber}의 새로운 주제를 정하세요. 초급 AI 개념 중 하나를 골라, 5일(월~금)에 걸쳐 나눠 가르칠 계획을 세우세요. 오늘은 그중 1일차(월요일)이며, 가장 기초적인 정의·개념을 소개하는 날입니다.`
    : `이번 Week ${weekNumber}의 주제는 "${weekTitle}"입니다. 오늘은 ${dayIndex}일차(${DAY_LABELS[dayIndex - 1]}요일)입니다. ${
        isReviewDay
          ? '이번 주 배운 세부 강의들을 종합해서 정리하고, 퀴즈로 복습하는 날입니다. 제목은 "퀴즈 & 정리"로 하세요.'
          : '이 주제를 이어가는 새로운 세부 개념 하나를 다루는 날입니다.'
      }`

  return `당신은 초급 AI 교육 콘텐츠 전문가입니다.

${weekInstruction}

요구사항:
- 완전한 초보자도 이해할 수 있는 쉬운 언어 사용
- 5분 이내에 읽을 수 있는 짧고 임팩트 있는 분량 (본문 3단락, 각 2-3문장)
- 일상적인 비유와 구체적인 예시 필수
- 오늘의 세부 주제 하나에만 집중하고, 전체 개념을 다 담으려 하지 마세요

반드시 아래 JSON 형식만 반환하세요. 다른 텍스트는 절대 포함하지 마세요:

{${isNewWeek ? '\n  "weekTitle": "이번 주 전체를 아우르는 주제 (예: AI란 무엇인가?)",' : ''}
  "title": "오늘 세부 강의 제목 (한국어, 흥미롭고 명확하게)",
  "description": "한 줄 설명 (한국어, 비유나 호기심을 자극하는 표현 포함)",
  "emoji": "주제에 맞는 이모지 1개",
  "content": [
    "단락1 (일상적 비유로 시작)",
    "단락2 (핵심 개념)",
    "단락3 (예시 또는 요약)"
  ],
  "keyCards": [
    { "emoji": "이모지", "title": "핵심 용어 1", "content": "2-3문장 설명" },
    { "emoji": "이모지", "title": "핵심 용어 2", "content": "2-3문장 설명" },
    { "emoji": "이모지", "title": "핵심 용어 3", "content": "2-3문장 설명" }
  ],
  "quiz": {
    "question": "강의 내용과 관련된 퀴즈 질문",
    "options": ["선택지 A", "선택지 B", "선택지 C", "선택지 D"],
    "correctIndex": 0,
    "explanation": "정답 해설 (친절하고 격려하는 톤으로)"
  },
  "readTime": "3분"
}`
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const slot = getNextSlot()
    const dayLabel = DAY_LABELS[slot.dayIndex - 1]

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: buildPrompt(slot.weekNumber, slot.dayIndex, slot.weekTitle),
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
    const weekTitle = slot.weekTitle ?? generated.weekTitle
    if (!weekTitle) {
      return NextResponse.json({ error: 'weekTitle missing from AI response' }, { status: 500 })
    }

    const slug = generated.title
      .toLowerCase()
      .replace(/[^가-힣a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 50)

    const lesson = {
      id: `w${slot.weekNumber}d${slot.dayIndex}`,
      slug: `week-${slot.weekNumber}-${slot.dayIndex}-${slug}`,
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

    return NextResponse.json({ lesson })
  } catch (err) {
    console.error('Lesson generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
