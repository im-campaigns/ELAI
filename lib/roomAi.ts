import Anthropic from '@anthropic-ai/sdk'
import { getDb, type AiInterest, type AiLevel, type AiStudentPersona, type DbAiStudent, type DbRoomMessage } from '@/lib/db'

export const AI_TEACHER_NICKNAME = 'AI쌤'
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_PER_MINUTE = 5
const RATE_LIMIT_NOTICE = '지금 질문이 많이 몰려서, 잠시 뒤에 다시 물어봐 주세요 🙏'
const FALLBACK_REPLY = '지금은 답하기 어려워요. 잠시 후 다시 물어봐 주세요.'
const RECENT_CONTEXT_LIMIT = 20

// AI 학생 비용 보호: 방마다 10분당 최대 5개 메시지만 생성한다.
const AI_STUDENT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const AI_STUDENT_RATE_LIMIT_MAX = 5
const AI_STUDENT_DEFAULT_REPLY_CHANCE = 0.25
// 사람처럼 시간차를 두고 메시지가 보이도록 생성 시점 + 5~40초 뒤에 visible_at을 잡는다.
const AI_STUDENT_DELAY_MIN_MS = 5 * 1000
const AI_STUDENT_DELAY_MAX_MS = 40 * 1000
const TEACHER_FOLLOW_UP_DELAY_MIN_MS = 5 * 1000
const TEACHER_FOLLOW_UP_DELAY_MAX_MS = 15 * 1000
const CLARIFICATION_TAG_PATTERN = /\[\[NEEDS_CLARIFICATION:\s*(yes|no)\s*\]\]/i

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

// AI쌤과 AI 학생이 공통으로 지켜야 하는 안전 규칙. 두 역할의 시스템 프롬프트에 모두 포함한다.
const SHARED_SAFETY_RULES = `- 회원에게 전화번호, 주소, 실명, 직장명, SNS 계정 등 개인정보를 절대 묻지 않습니다
- 회원이 개인정보를 올리면 "개인정보는 여기서 안 올리시는 게 좋을 것 같아요" 정도로 자연스럽게 말립니다
- 따로 연락하기, 오프라인 만남, 개인 메시지를 절대 제안하지 않습니다
- 누군가 "AI예요?", "진짜 사람이에요?"라고 진지하게 물으면 부정하지 않고 "저는 학습 분위기를 돕는 AI 참여자예요"라고 짧고 사실대로 답합니다
- 연애, 정치, 종교, 금전 이야기로 대화를 끌고 가지 않습니다
- 다른 회원의 직업, 수준 등 개인 프로필 정보를 대화 중 절대 언급하지 않습니다`

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

안전 규칙:
${SHARED_SAFETY_RULES}`
}

function studentPersonaPrompt(room: RoomContext, persona: AiStudentPersona): string {
  return `당신은 ELAI 그룹과외 방에 참여 중인 "가상 수강생"입니다. 절대로 자신이 AI라는 사실을 티내지 않고,
실제 수강생처럼 자연스럽게 대화에 참여합니다 (단, 누군가 진지하게 AI냐고 물으면 아래 안전 규칙대로 사실대로 답합니다).

당신의 설정:
- 연령대: ${persona.ageGroup}
- 직업/상황: ${persona.job}
- 이 방을 듣는 이유: ${persona.motivation}
- AI 이해 수준: ${persona.aiLevel}
- 성격: ${persona.personality}
- 말투: ${persona.speechStyle}

방 정보:
- 방 이름: ${room.name} (수준: ${levelLabel[room.level]}, 관심분야: ${room.interest})

대화 참여 규칙:
- 실제 수강생처럼 짧고 자연스럽게 1~2문장으로 반응합니다. 선생님처럼 길게 가르치려 하지 않습니다
- 당신의 말투와 성격을 꾸준히 유지합니다
- AI쌤의 진행(인사, 질문, 정리)을 방해하거나 끊지 않습니다
- 가끔(자주는 아니고 드물게) 당신의 AI 이해 수준에 맞게 AI 개념을 살짝 오해한 듯한 말을 해도 괜찮습니다. 단, 아래 안전 규칙은 절대 어기지 않습니다

안전 규칙:
${SHARED_SAFETY_RULES}

응답 형식:
- 답변 마지막 줄에 반드시 태그를 하나 붙입니다. 방금 답변에 AI 개념에 대한 가벼운 오해나 틀린 정보가 들어있으면 [[NEEDS_CLARIFICATION:yes]], 없으면 [[NEEDS_CLARIFICATION:no]]를 붙입니다`
}

function anthropicClient(): Anthropic {
  return new Anthropic()
}

const UNIQUE_VIOLATION_CODE = '23505'

function randomInt(minInclusive: number, maxExclusive: number): number {
  return Math.floor(minInclusive + Math.random() * (maxExclusive - minInclusive))
}

function parseClarificationTag(text: string): { content: string; needsClarification: boolean } {
  const match = text.match(CLARIFICATION_TAG_PATTERN)
  const needsClarification = match?.[1]?.toLowerCase() === 'yes'
  const content = text.replace(CLARIFICATION_TAG_PATTERN, '').trim()
  return { content, needsClarification }
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

async function insertAiMessage(
  roomId: string,
  content: string,
  kind?: string,
  visibleAt?: string,
): Promise<{ error: { code?: string } | null }> {
  const trimmed = content.trim()
  if (!trimmed) return { error: null }
  const { error } = await getDb().from('room_messages').insert({
    room_id: roomId,
    user_id: null,
    sender_type: 'ai_teacher',
    nickname: AI_TEACHER_NICKNAME,
    content: trimmed,
    ...(kind ? { kind } : {}),
    ...(visibleAt ? { visible_at: visibleAt } : {}),
  })
  if (error && error.code !== UNIQUE_VIOLATION_CODE) {
    console.error('[roomAi] AI쌤 메시지 저장 실패:', error)
  }
  return { error }
}

async function insertAiStudentMessage(params: {
  roomId: string
  studentId: string
  nickname: string
  content: string
  triggeredBy: string
}): Promise<{ error: { code?: string } | null; visibleAt: string | null }> {
  const trimmed = params.content.trim()
  if (!trimmed) return { error: null, visibleAt: null }

  const visibleAt = new Date(Date.now() + randomInt(AI_STUDENT_DELAY_MIN_MS, AI_STUDENT_DELAY_MAX_MS)).toISOString()
  const { error } = await getDb().from('room_messages').insert({
    room_id: params.roomId,
    user_id: null,
    ai_student_id: params.studentId,
    sender_type: 'ai_student',
    nickname: params.nickname,
    content: trimmed,
    visible_at: visibleAt,
    triggered_by: params.triggeredBy,
  })
  if (error && error.code !== UNIQUE_VIOLATION_CODE) {
    console.error('[roomAi] AI 학생 메시지 저장 실패:', error)
  }
  return { error, visibleAt: error ? null : visibleAt }
}

/**
 * 방에 입장할 때 한 번만 호출되는 전용 처리. AI쌤의 환영 인사 + 오늘의 질문을 올린다.
 * 환영 인사는 kind='welcome'으로 저장되고, room_messages에는 방당 kind='welcome' 행이
 * 하나만 존재하도록 DB 유니크 인덱스가 걸려 있다. 동시에 여러 요청이 들어와도
 * 실제로 저장되는 건 가장 먼저 insert에 성공한 요청 하나뿐이고, 나머지는 유니크 제약
 * 위반 에러를 받아 조용히 무시한다 (check-then-insert 방식의 race condition을 DB가 막아준다).
 */
export async function maybeSendWelcome(room: RoomContext): Promise<void> {
  const db = getDb()
  // 환영 인사는 방에 메시지가 하나도 없을 때(첫 승인 회원 입장)에만 보낸다.
  // 이미 대화가 쌓인 방이라면 kind='welcome' 행이 없더라도 새로 환영 인사를 만들지 않는다.
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

    await insertAiMessage(room.id, text, 'welcome')
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

async function isMostRecentMessageFromAiTeacher(roomId: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from('room_messages')
    .select('sender_type')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[roomAi] 최근 메시지 발신자 조회 실패:', error)
    return false
  }
  return data?.sender_type === 'ai_teacher'
}

/** 회원이 올린 트리거 메시지에 AI쌤이 답한다. 비용 보호를 위해 분당 응답 횟수를 제한한다. */
export async function maybeReplyToMember(
  room: RoomContext,
  trigger: { nickname: string; content: string },
): Promise<void> {
  // 연속 발언 방지: 가장 최근 메시지가 이미 AI쌤이면(동시 요청 등으로 먼저 답했다면)
  // 새 회원 메시지가 올라오기 전까지는 AI쌤이 또 말하지 않는다.
  if (await isMostRecentMessageFromAiTeacher(room.id)) return

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

async function countRecentAiStudentMessages(roomId: string): Promise<number> {
  const since = new Date(Date.now() - AI_STUDENT_RATE_LIMIT_WINDOW_MS).toISOString()
  const { count, error } = await getDb()
    .from('room_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('sender_type', 'ai_student')
    .gte('created_at', since)

  if (error) {
    console.error('[roomAi] 최근 AI 학생 메시지 수 조회 실패:', error)
    return AI_STUDENT_RATE_LIMIT_MAX // 조회에 실패하면 안전하게 더 생성하지 않는다
  }
  return count ?? 0
}

/**
 * AI 학생이 쓴 글에 가벼운 오해가 섞여 있을 때(NEEDS_CLARIFICATION:yes), AI쌤이 뒤이어
 * 자연스럽게 바로잡는다. AI쌤의 분당 응답 횟수 제한을 그대로 공유하며, 제한에 걸리면
 * 조용히 건너뛴다(AI 학생 발화는 이미 자연스러운 대화의 일부라 별도 안내는 띄우지 않는다).
 */
async function maybeSendStudentClarification(
  room: RoomContext,
  info: { studentNickname: string; studentContent: string; visibleAt: string },
): Promise<void> {
  const recentAiCount = await countRecentAiMessages(room.id)
  if (recentAiCount >= RATE_LIMIT_MAX_PER_MINUTE) return
  if (!process.env.ANTHROPIC_API_KEY) return

  try {
    const client = anthropicClient()
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 250,
      system: basePersonaPrompt(room),
      messages: [
        {
          role: 'user',
          content: `방금 ${info.studentNickname}님이 이렇게 말했어요: "${info.studentContent}"\n\n이 말에 담긴 AI 개념에 대한 가벼운 오해를 AI쌤으로서 짧게(1~3문장) 자연스럽게 바로잡아 주세요. ${info.studentNickname}님을 직접 지적하듯 말하지 말고, 자연스럽게 추가 설명을 덧붙이는 톤으로 답해주세요.`,
        },
      ],
    })

    const text = extractText(response)
    if (text) {
      await insertAiMessage(room.id, text, undefined, info.visibleAt)
    }
  } catch (err) {
    console.error('[roomAi] AI 학생 발언 보정 생성 실패:', err)
  }
}

/**
 * 회원이 메시지를 올리면, 방에 등록된 활성 AI 학생 중 "반응하기로" 확률이 맞은 사람 한 명만
 * 골라 자연스럽게 반응한다. AI쌤이 답할 질문(shouldAiReply)에는 끼지 않아 AI쌤의 진행을
 * 방해하지 않고, 회원 메시지 1개당 AI 학생 응답은 최대 1개로 제한한다. 비용 보호를 위해
 * 방마다 10분당 AI 학생 메시지 최대 5개로 막고, 같은 트리거 메시지에 대한 중복 응답은
 * room_messages.triggered_by의 부분 유니크 인덱스로 DB 차원에서도 막는다.
 */
export async function maybeTriggerAiStudent(
  room: RoomContext,
  trigger: { id: string; nickname: string; content: string },
): Promise<void> {
  if (shouldAiReply(trigger.content)) return

  const db = getDb()
  const { data: students, error } = await db
    .from('ai_students')
    .select('id, nickname, persona')
    .eq('room_id', room.id)
    .eq('is_active', true)

  if (error) {
    console.error('[roomAi] AI 학생 목록 조회 실패:', error)
    return
  }
  if (!students || students.length === 0) return

  const candidates = (students as Pick<DbAiStudent, 'id' | 'nickname' | 'persona'>[]).filter((s) => {
    const persona = s.persona as AiStudentPersona
    return Math.random() < (persona.replyChance ?? AI_STUDENT_DEFAULT_REPLY_CHANCE)
  })
  if (candidates.length === 0) return

  const chosen = candidates[Math.floor(Math.random() * candidates.length)]
  const persona = chosen.persona as AiStudentPersona

  if ((await countRecentAiStudentMessages(room.id)) >= AI_STUDENT_RATE_LIMIT_MAX) return
  if (!process.env.ANTHROPIC_API_KEY) return

  const { data: recent, error: historyError } = await db
    .from('room_messages')
    .select('nickname, sender_type, content')
    .eq('room_id', room.id)
    .order('created_at', { ascending: false })
    .limit(RECENT_CONTEXT_LIMIT)

  if (historyError) {
    console.error('[roomAi] AI 학생용 대화 조회 실패:', historyError)
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
      max_tokens: 200,
      system: studentPersonaPrompt(room, persona),
      messages: [
        {
          role: 'user',
          content: `다음은 이 방의 최근 대화입니다.\n\n${transcript}\n\n마지막 메시지(${trigger.nickname}: ${trigger.content})를 보고, 당신이라면 자연스럽게 어떻게 반응할지 가상 수강생으로서 짧게 답해주세요.`,
        },
      ],
    })

    const { content: cleaned, needsClarification } = parseClarificationTag(extractText(response))
    if (!cleaned) return

    const { error: insertError, visibleAt } = await insertAiStudentMessage({
      roomId: room.id,
      studentId: chosen.id,
      nickname: chosen.nickname,
      content: cleaned,
      triggeredBy: trigger.id,
    })
    if (insertError || !visibleAt) return

    if (needsClarification) {
      const followUpVisibleAt = new Date(
        new Date(visibleAt).getTime() + randomInt(TEACHER_FOLLOW_UP_DELAY_MIN_MS, TEACHER_FOLLOW_UP_DELAY_MAX_MS),
      ).toISOString()
      await maybeSendStudentClarification(room, {
        studentNickname: chosen.nickname,
        studentContent: cleaned,
        visibleAt: followUpVisibleAt,
      })
    }
  } catch (err) {
    console.error('[roomAi] AI 학생 답변 생성 실패:', err)
  }
}
