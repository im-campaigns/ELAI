import Anthropic from '@anthropic-ai/sdk'
import { getDb, type AiInterest, type AiLevel, type DbRoomMessage } from '@/lib/db'

export const AI_TEACHER_NICKNAME = 'AI쌤'
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_PER_MINUTE = 5
const RATE_LIMIT_NOTICE = '지금 질문이 많이 몰려서, 잠시 뒤에 다시 물어봐 주세요 🙏'
const FALLBACK_REPLY = '지금은 답하기 어려워요. 잠시 후 다시 물어봐 주세요.'
const RECENT_CONTEXT_LIMIT = 20

type RoomContext = {
  id: string
  name: string
  description: string
  level: AiLevel
  interest: AiInterest
}

const levelLabel: Record<AiLevel, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
}

function basePersonaPrompt(room: RoomContext): string {
  return `당신은 ELAI(Easy Learning AI)의 그룹과외 방 진행자 "AI쌤"입니다.

현재 방 정보:
- 방 이름: ${room.name}
- 방 수준: ${levelLabel[room.level]}
- 관심 분야: ${room.interest}
- 방 설명: ${room.description}

말투와 답변 규칙:
- 한국어로, 친근하고 쉬운 말투를 사용합니다
- 답변은 3~5문장 이내로 짧게 합니다
- 이 방의 수준(${levelLabel[room.level]})에 맞춰 초보자도 이해할 수 있게 설명합니다
- 방의 관심 분야(${room.interest})와 연결된 예시를 가능하면 사용합니다
- 회원에게 전화번호, 주소, 계좌번호 등 개인정보를 절대 묻지 않습니다
- 다른 회원의 직업, 수준 등 개인 프로필 정보를 대화 중 절대 언급하지 않습니다`
}

function anthropicClient(): Anthropic {
  return new Anthropic()
}

async function insertAiMessage(roomId: string, content: string): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) return
  const { error } = await getDb().from('room_messages').insert({
    room_id: roomId,
    user_id: null,
    sender_type: 'ai_teacher',
    nickname: AI_TEACHER_NICKNAME,
    content: trimmed,
  })
  if (error) {
    console.error('[roomAi] AI쌤 메시지 저장 실패:', error)
  }
}

/**
 * 방에 메시지가 하나도 없을 때(첫 승인 회원 입장) AI쌤의 환영 인사 + 오늘의 질문을 올린다.
 * 동시 요청에 의한 중복 생성을 막기 위해, 호출 직전에 다시 한 번 메시지 존재 여부를 확인한다.
 */
export async function maybeSendWelcome(room: RoomContext): Promise<void> {
  const db = getDb()
  const { count, error } = await db
    .from('room_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id)

  if (error) {
    console.error('[roomAi] 환영 메시지 확인 실패:', error)
    return
  }
  if ((count ?? 0) > 0) return

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[roomAi] ANTHROPIC_API_KEY가 설정되어 있지 않습니다.')
    return
  }

  try {
    const client = anthropicClient()
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system: basePersonaPrompt(room),
      messages: [
        {
          role: 'user',
          content:
            '방금 첫 번째 회원이 이 방에 입장했어요. AI쌤으로서 짧은 환영 인사를 건네고, 이 방의 수준과 관심 분야에 맞는 "오늘의 질문"을 하나 제시해주세요.',
        },
      ],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // 대기 중 다른 요청이 먼저 메시지를 만들었을 수 있으니 한 번 더 확인한다.
    const { count: recheckCount, error: recheckError } = await db
      .from('room_messages')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id)

    if (recheckError) {
      console.error('[roomAi] 환영 메시지 재확인 실패:', recheckError)
      return
    }
    if ((recheckCount ?? 0) > 0) return

    await insertAiMessage(room.id, text)
  } catch (err) {
    console.error('[roomAi] 환영 메시지 생성 실패:', err)
  }
}

/** 회원 메시지에 "AI쌤"이 포함되거나 물음표로 끝나면 AI쌤이 답변 대상으로 삼는다. */
export function shouldAiReply(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (trimmed.includes('AI쌤')) return true
  return trimmed.endsWith('?') || trimmed.endsWith('？')
}

async function countRecentAiMessages(roomId: string): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count, error } = await getDb()
    .from('room_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('sender_type', 'ai_teacher')
    .gte('created_at', since)

  if (error) {
    console.error('[roomAi] 최근 AI쌤 메시지 수 조회 실패:', error)
    return 0
  }
  return count ?? 0
}

async function hasRecentNotice(roomId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { data, error } = await getDb()
    .from('room_messages')
    .select('content')
    .eq('room_id', roomId)
    .eq('sender_type', 'ai_teacher')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[roomAi] 최근 안내 메시지 조회 실패:', error)
    return false
  }
  return data?.[0]?.content === RATE_LIMIT_NOTICE
}

/** 회원이 올린 트리거 메시지에 AI쌤이 답한다. 비용 보호를 위해 분당 응답 횟수를 제한한다. */
export async function maybeReplyToMember(
  room: RoomContext,
  trigger: { nickname: string; content: string },
): Promise<void> {
  const recentAiCount = await countRecentAiMessages(room.id)
  if (recentAiCount >= RATE_LIMIT_MAX_PER_MINUTE) {
    const alreadyNotified = await hasRecentNotice(room.id)
    if (!alreadyNotified) {
      await insertAiMessage(room.id, RATE_LIMIT_NOTICE)
    }
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[roomAi] ANTHROPIC_API_KEY가 설정되어 있지 않습니다.')
    await insertAiMessage(room.id, FALLBACK_REPLY)
    return
  }

  const { data: recent, error } = await getDb()
    .from('room_messages')
    .select('nickname, sender_type, content')
    .eq('room_id', room.id)
    .order('created_at', { ascending: false })
    .limit(RECENT_CONTEXT_LIMIT)

  if (error) {
    console.error('[roomAi] 최근 대화 조회 실패:', error)
    await insertAiMessage(room.id, FALLBACK_REPLY)
    return
  }

  const history = ((recent ?? []) as Pick<DbRoomMessage, 'nickname' | 'sender_type' | 'content'>[])
    .slice()
    .reverse()

  const transcript = history.map((m) => `${m.nickname}: ${m.content}`).join('\n')

  try {
    const client = anthropicClient()
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system: basePersonaPrompt(room),
      messages: [
        {
          role: 'user',
          content: `다음은 이 방의 최근 대화 기록입니다.\n\n${transcript}\n\n마지막 메시지(${trigger.nickname}: ${trigger.content})에 대해 AI쌤으로서 답변해주세요.`,
        },
      ],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    await insertAiMessage(room.id, text || FALLBACK_REPLY)
  } catch (err) {
    console.error('[roomAi] 답변 생성 실패:', err)
    await insertAiMessage(room.id, FALLBACK_REPLY)
  }
}
