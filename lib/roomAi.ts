import Anthropic from '@anthropic-ai/sdk'
import {
  getDb,
  type AiInterest,
  type AiLevel,
  type AiStudentPersona,
  type AiUsagePurpose,
  type DbAiStudent,
  type DbRoomMessage,
} from '@/lib/db'

export const AI_TEACHER_NICKNAME = 'AI쌤'
export const AI_TEACHER_LIMIT_MESSAGE = '잠시 후 다시 질문해 주세요. 질문이 너무 잦으면 AI쌤이 잠깐 쉬어가요 🙏'
export const AI_BUDGET_PAUSED_MESSAGE = 'AI쌤이 잠시 쉬고 있어요. 잠시 후 다시 질문해 주세요 🙏'

// 회원 질문에 대한 AI쌤의 본 답변만 기존 모델을 유지하고, 그 외(환영 인사/AI 학생/보정/요약)는
// 비용이 저렴한 모델을 쓴다.
const MAIN_MODEL = 'claude-opus-4-8'
const CHEAP_MODEL = 'claude-haiku-4-5-20251001'

const FALLBACK_REPLY = '지금은 답하기 어려워요. 잠시 후 다시 물어봐 주세요.'
// Claude에 보내는 "최근 대화" 원문은 최근 10개까지만. 그보다 오래된 내용은 요약으로 대체한다.
const RECENT_CONTEXT_LIMIT = 10
// 요약 이후 메시지가 이만큼 더 쌓이면 요약을 다시 만든다.
const SUMMARY_REFRESH_THRESHOLD = 30

// 사용자별 AI쌤 호출 한도(남용 방지 + 비용 보호). 넘으면 Claude를 호출하지 않고 바로 안내한다.
const AI_TEACHER_PER_USER_MINUTE_LIMIT = 3
const AI_TEACHER_PER_USER_MINUTE_WINDOW_MS = 60 * 1000
const AI_TEACHER_PER_USER_DAILY_LIMIT = 30
const AI_TEACHER_PER_USER_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000

// AI 학생 비용 보호: 방마다 10분당 최대 5개 메시지만 생성한다.
const AI_STUDENT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const AI_STUDENT_RATE_LIMIT_MAX = 5
// 회원 메시지 1개당 "AI 학생이 반응을 시도할지"를 결정하는 단일 확률(약 40%).
// 페르소나별 replyChance는 더 이상 반응 여부 결정에 쓰지 않고, 누가 반응할지 고르는 데만 쓴다.
const AI_STUDENT_REPLY_PROBABILITY = 0.4
// 사람처럼 시간차를 두고 메시지가 보이도록 생성 시점 + 5~40초 뒤에 visible_at을 잡는다(AI쌤 응답이 없는 경우).
const AI_STUDENT_STANDALONE_DELAY_MIN_MS = 5 * 1000
const AI_STUDENT_STANDALONE_DELAY_MAX_MS = 40 * 1000
// AI쌤이 먼저 답한 뒤 AI 학생이 자연스럽게 이어 반응하는 지연(4~10초).
const AI_STUDENT_FOLLOW_UP_DELAY_MIN_MS = 4 * 1000
const AI_STUDENT_FOLLOW_UP_DELAY_MAX_MS = 10 * 1000
const TEACHER_CLARIFICATION_DELAY_MIN_MS = 5 * 1000
const TEACHER_CLARIFICATION_DELAY_MAX_MS = 15 * 1000
const CLARIFICATION_TAG_PATTERN = /\[\[NEEDS_CLARIFICATION:\s*(yes|no)\s*\]\]/i

// 비용/무한반복 방지: 방별 하루 AI 메시지 상한.
const AI_DAILY_ROOM_MESSAGE_LIMIT = 100

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
- 따로 연락하기, 오프라인 만남, 개인 메시지, 외부 링크 공유를 절대 제안하지 않습니다
- 누군가 "AI예요?", "진짜 사람이에요?"라고 진지하게 물으면 부정하지 않고 "저는 학습 분위기를 돕는 AI 참여자예요"라고 짧고 사실대로 답합니다
- 연애, 정치, 종교, 금전 이야기로 대화를 끌고 가지 않습니다
- 다른 회원의 직업, 수준 등 개인 프로필 정보를 대화 중 절대 언급하지 않습니다
- 다른 참여자(AI쌤, 다른 회원, 다른 AI 참여자)를 대신해서 말하지 않고, 자기 자신에게 인사하거나 답하지 않습니다`

// 방의 "관심 분야"가 악기 기타(guitar) 등으로 오해되지 않도록 뜻을 명확히 알려주는 설명.
// 두 역할의 시스템 프롬프트에 모두 포함한다.
const INTEREST_EXPLANATION = `- '관심 분야'는 방이 다루는 주제 범주를 뜻합니다: 업무활용(회사/업무에 AI 활용), 공부(AI 자체를 배우기), 창작(글·이미지 등 창작에 AI 활용), 자유주제(특정 분야에 안 묶인 다양한 질문). 악기 "기타(guitar)"와는 전혀 관련이 없으니 혼동하지 않습니다
- 같은 비유, 표현, 예시를 대화에서 반복해서 쓰지 않습니다. 매번 다른 표현으로 설명합니다`

// 마크다운 굵게(**텍스트**) 표시가 따옴표/괄호와 바로 붙으면 일부 마크다운 렌더러에서
// 굵게 처리가 깨지고 **가 그대로 보이는 문제가 있어, 아예 그런 조합을 안 쓰게 한다.
const MARKDOWN_FORMAT_RULE = `- 굵게(**텍스트**) 표시를 쓸 때 ** 바로 안쪽에 따옴표(" ' " ')나 괄호(( ) [ ] { })를 붙이지 않습니다. 따옴표나 괄호는 항상 ** 바깥에 둡니다 (예: "**중요**"라고 쓰고, **"중요"**나 **(중요)**처럼 쓰지 않습니다)`

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
${INTEREST_EXPLANATION}
${MARKDOWN_FORMAT_RULE}

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
- 공감, 보충 설명, 가벼운 추가 질문 위주로 반응합니다
- 가끔(자주는 아니고 드물게) 당신의 AI 이해 수준에 맞게 AI 개념을 살짝 오해한 듯한 말을 해도 괜찮습니다. 단, 아래 안전 규칙은 절대 어기지 않습니다
- 당신 자신의 반응만 말합니다. 다른 참여자(AI쌤이나 다른 회원)를 대신해서 말하거나, 당신 자신에게 인사하거나 답하지 않습니다
${INTEREST_EXPLANATION}
${MARKDOWN_FORMAT_RULE}

안전 규칙:
${SHARED_SAFETY_RULES}

응답 형식:
- 답변 마지막 줄에 반드시 태그를 하나 붙입니다. 방금 답변에 AI 개념에 대한 가벼운 오해나 틀린 정보가 들어있으면 [[NEEDS_CLARIFICATION:yes]], 없으면 [[NEEDS_CLARIFICATION:no]]를 붙입니다`
}

function anthropicClient(): Anthropic {
  return new Anthropic()
}

/** 방 정보는 거의 고정값이라 캐시 적중률이 높다. 프롬프트 캐싱으로 반복 호출 비용을 줄인다. */
function cachedSystem(text: string): Anthropic.Messages.TextBlockParam[] {
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }]
}

/** 이전 대화 요약(있으면)과 최근 원문 대화를 하나의 사용자 메시지로 합친다. */
function buildContextualPrompt(summaryText: string | null, recentTranscript: string, instruction: string): string {
  const summaryBlock = summaryText ? `이전 대화 요약: ${summaryText}\n\n` : ''
  return `${summaryBlock}최근 대화:\n${recentTranscript}\n\n${instruction}`
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

// ---- 서버 측 안전 검사 ----
// 회원에게 전화번호/주소/SNS/외부 링크를 요구하거나 오프라인 만남·개인 연락을 유도하는 문장이
// AI 생성 결과에 섞여 나오면(프롬프트 규칙을 지켰어도 모델이 실수할 수 있다), 통째로
// 안전한 대체 문구로 바꿔서 저장한다. 시스템 프롬프트(SHARED_SAFETY_RULES)가 1차 방어선이고,
// 이 필터가 2차 방어선이다.
const UNSAFE_PATTERNS: RegExp[] = [
  /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/, // 휴대폰 번호
  /\d{2,4}[-.\s]\d{3,4}[-.\s]\d{4}/, // 일반 전화번호 형태
  /https?:\/\/\S+/i, // URL
  /\bwww\.\S+/i,
  /[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // 이메일
  /카카오\s?(톡|아이디)|라인\s?아이디|인스타(그램)?\s?(아이디|계정)?|오픈\s?채팅/,
  /따로\s?연락|개인\s?(메시지|연락|톡)|오프라인에서\s?(만나|보)/,
]

const UNSAFE_FALLBACK_REPLY = '죄송해요, 그 부분은 여기서 다루기 어려워요. 다른 질문을 편하게 올려주세요 🙏'

function sanitizeAiOutput(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    console.error('[roomAi] 안전 규칙 위반 가능성이 있는 AI 출력을 차단했습니다.')
    return UNSAFE_FALLBACK_REPLY
  }
  return trimmed
}

/** 토큰 사용량을 ai_usage_log에 적재한다. 실패해도 채팅 흐름을 막지 않는 fire-and-forget. */
function logUsage(params: {
  roomId: string
  purpose: AiUsagePurpose
  model: string
  usage?: { input_tokens: number; output_tokens: number }
}): void {
  if (!params.usage) return
  getDb()
    .from('ai_usage_log')
    .insert({
      room_id: params.roomId,
      purpose: params.purpose,
      model: params.model,
      input_tokens: params.usage.input_tokens,
      output_tokens: params.usage.output_tokens,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error('[roomAi] 토큰 사용량 기록 실패:', error)
    })
}

async function insertAiMessage(
  roomId: string,
  content: string,
  options: { kind?: string; visibleAt?: string; triggeredBy?: string; userId?: string } = {},
): Promise<{ error: { code?: string } | null; visibleAt: string | null }> {
  const trimmed = content.trim()
  if (!trimmed) return { error: null, visibleAt: null }
  const visibleAt = options.visibleAt ?? new Date().toISOString()
  const { error } = await getDb().from('room_messages').insert({
    room_id: roomId,
    user_id: options.userId ?? null,
    sender_type: 'ai_teacher',
    nickname: AI_TEACHER_NICKNAME,
    content: trimmed,
    ...(options.kind ? { kind: options.kind } : {}),
    visible_at: visibleAt,
    ...(options.triggeredBy ? { triggered_by: options.triggeredBy } : {}),
  })
  if (error && error.code !== UNIQUE_VIOLATION_CODE) {
    console.error('[roomAi] AI쌤 메시지 저장 실패:', error)
  }
  return { error, visibleAt: error ? null : visibleAt }
}

async function insertAiStudentMessage(params: {
  roomId: string
  studentId: string
  nickname: string
  content: string
  triggeredBy: string
  visibleAt: string
}): Promise<{ error: { code?: string } | null; visibleAt: string | null }> {
  const trimmed = params.content.trim()
  if (!trimmed) return { error: null, visibleAt: null }

  const { error } = await getDb().from('room_messages').insert({
    room_id: params.roomId,
    user_id: null,
    ai_student_id: params.studentId,
    sender_type: 'ai_student',
    nickname: params.nickname,
    content: trimmed,
    visible_at: params.visibleAt,
    triggered_by: params.triggeredBy,
  })
  if (error && error.code !== UNIQUE_VIOLATION_CODE) {
    console.error('[roomAi] AI 학생 메시지 저장 실패:', error)
  }
  return { error, visibleAt: error ? null : params.visibleAt }
}

/**
 * 방의 대화 요약을 조회하고, 필요하면(원문으로 보내는 최근 메시지 범위를 벗어난 구간이
 * SUMMARY_REFRESH_THRESHOLD개 이상 쌓였으면) Haiku로 새로 갱신한다.
 * 요약 대상은 "최근 RECENT_CONTEXT_LIMIT개를 제외한" 더 오래된 구간이다.
 */
async function getOrRefreshSummary(roomId: string, totalMessageCount: number): Promise<string | null> {
  const db = getDb()
  const { data: existing, error } = await db
    .from('room_conversation_summaries')
    .select('summary, message_count_at_summary')
    .eq('room_id', roomId)
    .maybeSingle()

  if (error) {
    console.error('[roomAi] 대화 요약 조회 실패:', error)
    return null
  }

  const checkpoint = existing?.message_count_at_summary ?? 0
  const currentSummary = existing?.summary || null

  const summarizableCount = totalMessageCount - RECENT_CONTEXT_LIMIT
  if (summarizableCount - checkpoint < SUMMARY_REFRESH_THRESHOLD) {
    return currentSummary
  }
  if (!process.env.ANTHROPIC_API_KEY) return currentSummary

  const { data: deltaRows, error: deltaError } = await db
    .from('room_messages')
    .select('nickname, sender_type, content')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .range(checkpoint, summarizableCount - 1)

  if (deltaError || !deltaRows || deltaRows.length === 0) {
    if (deltaError) console.error('[roomAi] 요약 대상 조회 실패:', deltaError)
    return currentSummary
  }

  const deltaTranscript = (deltaRows as Pick<DbRoomMessage, 'nickname' | 'sender_type' | 'content'>[])
    .map((m) => `${m.nickname}: ${m.content}`)
    .join('\n')

  try {
    const client = anthropicClient()
    const response = await client.messages.create({
      model: CHEAP_MODEL,
      max_tokens: 300,
      system:
        '당신은 대화 요약 도우미입니다. 아래 그룹과외 방 대화를 한국어 3~5문장으로 간결하게 요약하세요. 누가 무엇을 물었고 AI쌤이 어떻게 답했는지 핵심만 남깁니다.',
      messages: [
        {
          role: 'user',
          content: currentSummary
            ? `이전 요약:\n${currentSummary}\n\n이어지는 새 대화:\n${deltaTranscript}\n\n위 이전 요약과 새 대화를 합쳐 3~5문장으로 업데이트된 요약을 만들어주세요.`
            : `다음 대화를 3~5문장으로 요약해주세요.\n\n${deltaTranscript}`,
        },
      ],
    })

    const newSummary = extractText(response).trim()
    logUsage({ roomId, purpose: 'summary', model: CHEAP_MODEL, usage: response.usage })
    if (!newSummary) return currentSummary

    const { error: upsertError } = await db.from('room_conversation_summaries').upsert({
      room_id: roomId,
      summary: newSummary,
      message_count_at_summary: summarizableCount,
      updated_at: new Date().toISOString(),
    })
    if (upsertError) console.error('[roomAi] 대화 요약 저장 실패:', upsertError)

    return newSummary
  } catch (err) {
    console.error('[roomAi] 대화 요약 생성 실패:', err)
    return currentSummary
  }
}

/** AI쌤/AI 학생 호출에 공통으로 쓰는 맥락(요약 + 최근 원문 10개)을 가져온다. */
async function getConversationContext(roomId: string): Promise<{ summaryText: string | null; recentTranscript: string }> {
  const db = getDb()

  const [{ count: totalCount }, { data: recentRows, error: recentError }] = await Promise.all([
    db.from('room_messages').select('id', { count: 'exact', head: true }).eq('room_id', roomId),
    db
      .from('room_messages')
      .select('nickname, sender_type, content')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(RECENT_CONTEXT_LIMIT),
  ])

  if (recentError) {
    console.error('[roomAi] 최근 대화 조회 실패:', recentError)
  }

  const recentHistory = ((recentRows ?? []) as Pick<DbRoomMessage, 'nickname' | 'sender_type' | 'content'>[])
    .slice()
    .reverse()
  const recentTranscript = recentHistory.map((m) => `${m.nickname}: ${m.content}`).join('\n')

  const summaryText = await getOrRefreshSummary(roomId, totalCount ?? 0)
  return { summaryText, recentTranscript }
}

/**
 * 방의 가장 최근 메시지 2개가 전부 AI(AI쌤/AI 학생)인지 확인한다. 무한 반복 방지의
 * 2차 방어선: 구조적으로는 AI 메시지가 새 AI 생성을 트리거할 길이 없지만(AI는 항상
 * 회원이 보낸 member 메시지의 triggered_by로만 생성된다), 혹시 모를 레이스 컨디션이나
 * 향후 코드 변경에 대비해 생성 직전에 한 번 더 확인한다.
 */
async function lastTwoMessagesAreAi(roomId: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from('room_messages')
    .select('sender_type')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(2)

  if (error) {
    console.error('[roomAi] 최근 메시지 발신자 확인 실패:', error)
    return false
  }
  const rows = (data ?? []) as Pick<DbRoomMessage, 'sender_type'>[]
  if (rows.length < 2) return false
  return rows.every((r) => r.sender_type === 'ai_teacher' || r.sender_type === 'ai_student')
}

async function countAiMessagesToday(roomId: string): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { count, error } = await getDb()
    .from('room_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .in('sender_type', ['ai_teacher', 'ai_student'])
    .gte('created_at', startOfDay.toISOString())

  if (error) {
    console.error('[roomAi] 방별 오늘 AI 메시지 수 조회 실패:', error)
    return AI_DAILY_ROOM_MESSAGE_LIMIT // 조회 실패 시 안전하게 더 생성하지 않는다
  }
  return count ?? 0
}

async function getTodayTotalTokens(): Promise<number | null> {
  const budget = Number(process.env.AI_DAILY_TOKEN_BUDGET)
  if (!Number.isFinite(budget) || budget <= 0) return null // 예산 미설정이면 검사하지 않는다

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { data, error } = await getDb()
    .from('ai_usage_log')
    .select('input_tokens, output_tokens')
    .gte('created_at', startOfDay.toISOString())

  if (error) {
    console.error('[roomAi] 전체 토큰 사용량 조회 실패:', error)
    return budget // 조회 실패 시 안전하게 예산 초과로 간주한다
  }
  const used = (data ?? []).reduce((sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0), 0)
  return used
}

/** 방별 상한/전체 토큰 예산을 넘었는지 확인한다. 넘었으면 Claude를 호출하지 않는다. */
async function isAiBudgetExceeded(roomId: string): Promise<boolean> {
  const [roomCount, totalTokens] = await Promise.all([countAiMessagesToday(roomId), getTodayTotalTokens()])
  if (roomCount >= AI_DAILY_ROOM_MESSAGE_LIMIT) return true

  const budget = Number(process.env.AI_DAILY_TOKEN_BUDGET)
  if (totalTokens !== null && Number.isFinite(budget) && budget > 0 && totalTokens >= budget) return true
  return false
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
      model: CHEAP_MODEL,
      max_tokens: 400,
      system: cachedSystem(basePersonaPrompt(room)),
      messages: [
        {
          role: 'user',
          content:
            '방금 첫 번째 회원이 이 방에 입장했어요. AI쌤으로서 짧은 환영 인사를 건네고, 이 방의 수준과 관심 분야에 맞는 "오늘의 질문"을 하나 제시해주세요.',
        },
      ],
    })

    const text = sanitizeAiOutput(extractText(response))
    logUsage({ roomId: room.id, purpose: 'welcome', model: CHEAP_MODEL, usage: response.usage })
    await insertAiMessage(room.id, text, { kind: 'welcome' })
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

async function countAiTeacherRepliesForUser(roomId: string, userId: string, windowMs: number): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString()
  const { count, error } = await getDb()
    .from('room_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .eq('sender_type', 'ai_teacher')
    .gte('created_at', since)

  if (error) {
    console.error('[roomAi] 사용자별 AI쌤 응답 수 조회 실패:', error)
    return 0
  }
  return count ?? 0
}

type TeacherTrigger = { id: string; nickname: string; content: string; userId: string }
type StudentTrigger = { id: string; nickname: string; content: string }

/**
 * Claude를 호출하기 전에 빠르게(DB 조회만) 확인하는 사전 검사. 채팅 응답 속도를 위해
 * route.ts가 이 함수는 await로 즉시 확인하고, 실제 생성(runTeacherReply)은 백그라운드로
 * 넘긴다. 차단된 경우에만 회원에게 보여줄 안내 문구를 함께 돌려준다.
 */
export async function precheckTeacherReply(
  room: RoomContext,
  trigger: TeacherTrigger,
): Promise<{ blocked: boolean; message?: string }> {
  const [minuteCount, dailyCount] = await Promise.all([
    countAiTeacherRepliesForUser(room.id, trigger.userId, AI_TEACHER_PER_USER_MINUTE_WINDOW_MS),
    countAiTeacherRepliesForUser(room.id, trigger.userId, AI_TEACHER_PER_USER_DAILY_WINDOW_MS),
  ])
  if (minuteCount >= AI_TEACHER_PER_USER_MINUTE_LIMIT || dailyCount >= AI_TEACHER_PER_USER_DAILY_LIMIT) {
    return { blocked: true, message: AI_TEACHER_LIMIT_MESSAGE }
  }

  if (await isAiBudgetExceeded(room.id)) {
    return { blocked: true, message: AI_BUDGET_PAUSED_MESSAGE }
  }

  if (await lastTwoMessagesAreAi(room.id)) {
    return { blocked: true }
  }

  return { blocked: false }
}

/**
 * AI쌤의 본 답변을 생성하고 저장한다. 느린 Claude 호출이 포함되어 있으므로 route.ts에서
 * waitUntil로 백그라운드 실행한다(precheckTeacherReply를 먼저 통과한 뒤에만 호출됨).
 * 성공하면 이어서(백그라운드 안에서) AI 학생의 4~10초 지연 후속 반응을 시도한다.
 */
export async function runTeacherReply(room: RoomContext, trigger: TeacherTrigger): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[roomAi] ANTHROPIC_API_KEY가 설정되어 있지 않습니다.')
    await insertAiMessage(room.id, FALLBACK_REPLY, { triggeredBy: trigger.id, userId: trigger.userId })
    return
  }

  const { summaryText, recentTranscript } = await getConversationContext(room.id)
  let teacherVisibleAt: string | null = null

  try {
    const client = anthropicClient()
    const response = await client.messages.create({
      model: MAIN_MODEL,
      max_tokens: 400,
      system: cachedSystem(basePersonaPrompt(room)),
      messages: [
        {
          role: 'user',
          content: buildContextualPrompt(
            summaryText,
            recentTranscript,
            `마지막 메시지(${trigger.nickname}: ${trigger.content})에 대해 AI쌤으로서 답변해주세요.`,
          ),
        },
      ],
    })

    const text = sanitizeAiOutput(extractText(response))
    logUsage({ roomId: room.id, purpose: 'ai_teacher_reply', model: MAIN_MODEL, usage: response.usage })
    const { visibleAt } = await insertAiMessage(room.id, text || FALLBACK_REPLY, {
      triggeredBy: trigger.id,
      userId: trigger.userId,
    })
    teacherVisibleAt = visibleAt
  } catch (err) {
    console.error('[roomAi] 답변 생성 실패:', err)
    const { visibleAt } = await insertAiMessage(room.id, FALLBACK_REPLY, {
      triggeredBy: trigger.id,
      userId: trigger.userId,
    })
    teacherVisibleAt = visibleAt
  }

  if (!teacherVisibleAt) return
  // AI쌤이 답한 트리거에도 AI 학생이 ~40% 확률로 4~10초 뒤 자연스럽게 반응할 수 있다
  // ("회원 메시지 1개당 AI 발언 최대 2개: AI쌤 1 + AI 학생 최대 1").
  await maybeTriggerAiStudent(
    room,
    { id: trigger.id, nickname: trigger.nickname, content: trigger.content },
    { baseAtIso: teacherVisibleAt, delayMinMs: AI_STUDENT_FOLLOW_UP_DELAY_MIN_MS, delayMaxMs: AI_STUDENT_FOLLOW_UP_DELAY_MAX_MS },
  )
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
 * 자연스럽게 바로잡는다. 간단한 보정 작업이라 저렴한 모델을 쓴다.
 */
async function maybeSendStudentClarification(
  room: RoomContext,
  info: { studentNickname: string; studentContent: string; visibleAt: string },
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) return
  if (await isAiBudgetExceeded(room.id)) return

  try {
    const client = anthropicClient()
    const response = await client.messages.create({
      model: CHEAP_MODEL,
      max_tokens: 250,
      system: cachedSystem(basePersonaPrompt(room)),
      messages: [
        {
          role: 'user',
          content: `방금 ${info.studentNickname}님이 이렇게 말했어요: "${info.studentContent}"\n\n이 말에 담긴 AI 개념에 대한 가벼운 오해를 AI쌤으로서 짧게(1~3문장) 자연스럽게 바로잡아 주세요. ${info.studentNickname}님을 직접 지적하듯 말하지 말고, 자연스럽게 추가 설명을 덧붙이는 톤으로 답해주세요.`,
        },
      ],
    })

    const text = sanitizeAiOutput(extractText(response))
    logUsage({ roomId: room.id, purpose: 'clarification', model: CHEAP_MODEL, usage: response.usage })
    if (text) {
      await insertAiMessage(room.id, text, { visibleAt: info.visibleAt })
    }
  } catch (err) {
    console.error('[roomAi] AI 학생 발언 보정 생성 실패:', err)
  }
}

/**
 * 회원이 메시지를 올리면, ~40% 확률로 방에 등록된 활성 AI 학생 중 한 명이 자연스럽게 반응한다.
 * (role) options가 없으면(AI쌤이 답하지 않는 메시지) "지금부터" 5~40초 뒤에, options로
 * baseAtIso가 주어지면(AI쌤 응답 뒤) 그 시각 기준 4~10초 뒤에 표시된다.
 * 회원 메시지 1개당 AI 학생 응답은 최대 1개로 제한되고, 같은 트리거 메시지에 대한 중복
 * 응답은 room_messages.triggered_by의 부분 유니크 인덱스로 DB 차원에서도 막힌다.
 * 비용 보호를 위해 방마다 10분당 AI 학생 메시지 최대 5개로 막는다. 간단한 작업이라
 * 저렴한 모델을 쓴다.
 */
export async function maybeTriggerAiStudent(
  room: RoomContext,
  trigger: StudentTrigger,
  options?: { baseAtIso: string; delayMinMs: number; delayMaxMs: number },
): Promise<void> {
  if (Math.random() >= AI_STUDENT_REPLY_PROBABILITY) return
  if (await isAiBudgetExceeded(room.id)) return
  if (await lastTwoMessagesAreAi(room.id)) return

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

  const pool = students as Pick<DbAiStudent, 'id' | 'nickname' | 'persona'>[]
  const chosen = pool[Math.floor(Math.random() * pool.length)]
  const persona = chosen.persona as AiStudentPersona

  if ((await countRecentAiStudentMessages(room.id)) >= AI_STUDENT_RATE_LIMIT_MAX) return
  if (!process.env.ANTHROPIC_API_KEY) return

  const { summaryText, recentTranscript } = await getConversationContext(room.id)

  const baseAtMs = options ? new Date(options.baseAtIso).getTime() : Date.now()
  const delayMinMs = options?.delayMinMs ?? AI_STUDENT_STANDALONE_DELAY_MIN_MS
  const delayMaxMs = options?.delayMaxMs ?? AI_STUDENT_STANDALONE_DELAY_MAX_MS
  const visibleAt = new Date(Math.max(baseAtMs, Date.now()) + randomInt(delayMinMs, delayMaxMs)).toISOString()

  try {
    const client = anthropicClient()
    const response = await client.messages.create({
      model: CHEAP_MODEL,
      max_tokens: 150,
      system: cachedSystem(studentPersonaPrompt(room, persona)),
      messages: [
        {
          role: 'user',
          content: buildContextualPrompt(
            summaryText,
            recentTranscript,
            `마지막 메시지(${trigger.nickname}: ${trigger.content})를 보고, 당신이라면 자연스럽게 어떻게 반응할지 가상 수강생으로서 짧게 답해주세요.`,
          ),
        },
      ],
    })

    const { content: cleaned, needsClarification } = parseClarificationTag(extractText(response))
    const sanitized = sanitizeAiOutput(cleaned)
    logUsage({ roomId: room.id, purpose: 'ai_student_reply', model: CHEAP_MODEL, usage: response.usage })
    if (!sanitized) return

    const { error: insertError, visibleAt: insertedVisibleAt } = await insertAiStudentMessage({
      roomId: room.id,
      studentId: chosen.id,
      nickname: chosen.nickname,
      content: sanitized,
      triggeredBy: trigger.id,
      visibleAt,
    })
    if (insertError || !insertedVisibleAt) return

    if (needsClarification && sanitized === cleaned) {
      const followUpVisibleAt = new Date(
        new Date(insertedVisibleAt).getTime() +
          randomInt(TEACHER_CLARIFICATION_DELAY_MIN_MS, TEACHER_CLARIFICATION_DELAY_MAX_MS),
      ).toISOString()
      await maybeSendStudentClarification(room, {
        studentNickname: chosen.nickname,
        studentContent: sanitized,
        visibleAt: followUpVisibleAt,
      })
    }
  } catch (err) {
    console.error('[roomAi] AI 학생 답변 생성 실패:', err)
  }
}
