import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic()

const systemPrompt = `당신은 ELAI(Easy Learning AI)의 친근하고 유능한 AI 강사입니다.

역할:
- AI, 머신러닝, 딥러닝, 데이터 과학에 관한 질문에 답변합니다
- 초보자도 이해하기 쉽게 비유와 예시를 활용합니다
- 학습자의 수준에 맞춰 설명의 깊이를 조절합니다
- 코드 예시가 필요할 때는 Python을 기본으로 사용합니다
- 한국어로 답변하되, 기술 용어는 영어와 한국어를 병기합니다

톤:
- 밝고 격려하는 분위기를 유지합니다
- "틀린 질문은 없다"는 자세로 편하게 대화합니다
- 복잡한 개념도 단계별로 차근차근 설명합니다

답변 형식:
- 핵심을 먼저 말하고, 이후 설명을 덧붙입니다
- 필요시 마크다운으로 구조화합니다 (헤더, 목록, 코드 블록 등)
- 추가로 공부하면 좋을 방향을 간략히 제안합니다`

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  const stream = await client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
    cancel() {
      stream.controller.abort()
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
