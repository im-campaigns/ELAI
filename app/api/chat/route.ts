import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const systemPrompt = `당신은 ELAI(Easy Learning AI)의 AI 채팅 강사 "엘라이 쌤"입니다.

역할:
- AI, 머신러닝, 딥러닝, 데이터 과학에 관한 질문에 답변합니다
- 초보자도 이해하기 쉽게 비유와 예시를 활용합니다
- 학습자의 수준에 맞춰 설명의 깊이를 조절합니다
- 코드 예시가 필요할 때는 Python을 기본으로 사용합니다
- 한국어로 답변하되, 기술 용어는 영어와 한국어를 병기합니다

페르소나:
- 이름은 "엘라이 쌤"이며, 옆집 친한 선생님처럼 편안하고 다정한 말투를 씁니다
- 이모지를 적절히 섞어 친근한 분위기를 유지합니다 (과하지 않게)
- "틀린 질문은 없다"는 자세로 어떤 질문이든 환영합니다
- 복잡한 개념도 단계별로 차근차근, 격려하는 톤으로 설명합니다

답변 형식:
- 핵심을 먼저 말하고, 이후 설명을 덧붙입니다
- 필요시 마크다운으로 구조화합니다 (헤더, 목록, 코드 블록 등)
- 추가로 공부하면 좋을 방향을 간략히 제안합니다`

function errorMessageFor(err: unknown): { message: string; status: number } {
  if (err instanceof Anthropic.AuthenticationError) {
    return { message: 'AI 서버 인증에 실패했어요. 관리자에게 API 키 설정을 확인해달라고 알려주세요.', status: 500 }
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return { message: 'AI 서버 접근 권한이 없어요. 관리자에게 문의해주세요.', status: 500 }
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { message: '지금 요청이 몰려 있어요. 잠시 후 다시 시도해주세요.', status: 429 }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { message: 'AI 서버와 연결이 원활하지 않아요. 네트워크 상태를 확인하고 다시 시도해주세요.', status: 503 }
  }
  if (err instanceof Anthropic.APIError) {
    return { message: '엘라이 쌤이 잠시 답변을 만들지 못했어요. 잠시 후 다시 시도해주세요.', status: 502 }
  }
  return { message: '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.', status: 500 }
}

export async function POST(req: NextRequest) {
  let messages: Anthropic.MessageParam[]

  try {
    const body = await req.json()
    messages = body?.messages
  } catch {
    return new Response(JSON.stringify({ error: '요청 형식이 올바르지 않아요.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: '메시지가 비어 있어요.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[chat] ANTHROPIC_API_KEY가 설정되어 있지 않습니다.')
    return new Response(
      JSON.stringify({ error: '서버에 AI API 키가 설정되어 있지 않아요. 관리자에게 문의해주세요.' }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    )
  }

  const client = new Anthropic()

  let stream: ReturnType<typeof client.messages.stream>
  try {
    stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })
  } catch (err) {
    console.error('[chat] 스트림 생성 실패:', err)
    const { message, status } = errorMessageFor(err)
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        console.error('[chat] 스트리밍 중 오류:', err)
        const { message } = errorMessageFor(err)
        // 스트림이 이미 시작된 뒤라 상태 코드는 바꿀 수 없으니, 본문에 안내 메시지를 흘려보낸다
        controller.enqueue(encoder.encode(`\n\n⚠️ ${message}`))
        controller.close()
      }
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
