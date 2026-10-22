import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDb, type AiInterest, type AiLevel } from '@/lib/db'
import { ConfigError } from '@/lib/errors'

const AI_INTERESTS: AiInterest[] = ['업무활용', '공부', '창작', '기타']
const AI_LEVELS: AiLevel[] = ['beginner', 'intermediate', 'advanced']

const systemPrompt = `당신은 ELAI(Easy Learning AI)의 AI쌤입니다. 지금은 방금 가입한 신규 회원과 첫 대화를 나누는 "온보딩" 시간입니다.

목표: 딱딱한 설문이 아니라 친근한 잡담처럼 대화하면서 아래 세 가지를 자연스럽게 파악합니다.
1. 직업 또는 하는 일
2. AI 관심 분야 — 반드시 다음 중 하나로 분류: 업무활용 / 공부 / 창작 / 기타
3. 현재 AI 사용 수준 — 사용자가 "전혀 모름", "들어본 적 있음", "조금 써봤음", "자주 씀" 중 어떤 식으로 답하든, 내부적으로 다음 기준으로 매핑:
   - 전혀 모름, 들어본 적 있음 → beginner
   - 조금 써봤음 → intermediate
   - 자주 씀 → advanced

대화 방식:
- 한 번에 하나씩만 물어봅니다 (질문 폭격 금지)
- 옆집 친한 선생님처럼 편안하고 다정한 말투, 이모지 적절히 사용 (과하지 않게)
- 사용자의 답변에 짧게 공감하거나 리액션을 한 뒤 다음 질문으로 자연스럽게 이어갑니다
- 세 가지 정보를 모두 파악하기 전까지는 절대 complete_onboarding 도구를 호출하지 않습니다
- 세 가지를 모두 파악했다면, 그 사실을 알리는 짧고 반가운 멘트(예: "오 좋아요! 이제 맞춤 커리큘럼 준비해드릴게요 🎉" 같은 말)를 답변에 포함하면서 동시에 complete_onboarding 도구를 호출합니다
- 이미 답변으로 알게 된 정보를 다시 묻지 않습니다`

const completeOnboardingTool: Anthropic.Tool = {
  name: 'complete_onboarding',
  description: '대화를 통해 사용자의 직업, AI 관심 분야, AI 사용 수준을 모두 파악했을 때 한 번만 호출합니다.',
  input_schema: {
    type: 'object',
    properties: {
      job: { type: 'string', description: '사용자의 직업 또는 하는 일 (자연어 그대로)' },
      ai_interest: { type: 'string', enum: AI_INTERESTS, description: 'AI 관심 분야 분류' },
      ai_level: { type: 'string', enum: AI_LEVELS, description: '현재 AI 사용 수준 (내부 매핑 기준 적용)' },
    },
    required: ['job', 'ai_interest', 'ai_level'],
  },
}

async function saveMessage(userId: string, role: 'user' | 'assistant', content: string) {
  if (!content.trim()) return
  try {
    await getDb().from('chat_messages').insert({ user_id: userId, role, content })
  } catch (err) {
    console.error('[chat/onboarding] 히스토리 저장 실패:', err)
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  if (user.onboarding_done) {
    return NextResponse.json({
      reply: '이미 온보딩을 마쳤어요! 편하게 무엇이든 물어보세요 😊',
      done: true,
      level: user.ai_level,
    })
  }

  let messages: Anthropic.MessageParam[]
  try {
    const body = await req.json()
    messages = body?.messages
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: '메시지가 비어 있어요.' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[chat/onboarding] ANTHROPIC_API_KEY가 설정되어 있지 않습니다.')
    return NextResponse.json(
      { error: '서버에 AI API 키가 설정되어 있지 않아요. 관리자에게 문의해주세요.' },
      { status: 500 },
    )
  }

  const lastUserMessage = messages[messages.length - 1]
  if (lastUserMessage?.role === 'user' && typeof lastUserMessage.content === 'string') {
    await saveMessage(user.id, 'user', lastUserMessage.content)
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      system: systemPrompt,
      tools: [completeOnboardingTool],
      messages,
    })

    let replyText = ''
    let toolInput: { job: string; ai_interest: string; ai_level: string } | null = null

    for (const block of response.content) {
      if (block.type === 'text') {
        replyText += block.text
      } else if (block.type === 'tool_use' && block.name === 'complete_onboarding') {
        toolInput = block.input as { job: string; ai_interest: string; ai_level: string }
      }
    }

    if (toolInput) {
      const job = toolInput.job?.trim() || '알 수 없음'
      const ai_interest = AI_INTERESTS.includes(toolInput.ai_interest as AiInterest)
        ? (toolInput.ai_interest as AiInterest)
        : '기타'
      const ai_level = AI_LEVELS.includes(toolInput.ai_level as AiLevel)
        ? (toolInput.ai_level as AiLevel)
        : 'beginner'

      const { error: updateError } = await getDb()
        .from('users')
        .update({ job, ai_interest, ai_level, onboarding_done: true })
        .eq('id', user.id)

      if (updateError) {
        console.error('[chat/onboarding] 프로필 저장 실패:', updateError)
        return NextResponse.json({ error: '온보딩 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 })
      }

      const fallbackReply = `${job}이시군요! 이제 ${user.nickname}님께 꼭 맞는 커리큘럼을 준비해드릴게요 🎉`
      const reply = replyText.trim() || fallbackReply
      await saveMessage(user.id, 'assistant', reply)

      return NextResponse.json({ reply, done: true, level: ai_level })
    }

    await saveMessage(user.id, 'assistant', replyText)
    return NextResponse.json({ reply: replyText, done: false })
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[chat/onboarding] 설정 오류:', err.message)
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error('[chat/onboarding] 알 수 없는 오류:', err)
    return NextResponse.json(
      { error: 'AI쌤이 잠시 답변을 만들지 못했어요. 잠시 후 다시 시도해주세요.' },
      { status: 502 },
    )
  }
}
