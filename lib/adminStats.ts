import { getDb } from '@/lib/db'
import { getOrderedSubtopicIds } from '@/lib/curriculum'
import { AI_DAILY_ROOM_MESSAGE_LIMIT, MAIN_MODEL } from '@/lib/roomAi'

/**
 * 관리자 대시보드(3-4)용 집계. 서버에서만 호출한다.
 * "오늘"은 토큰 예산(AI_DAILY_TOKEN_BUDGET)을 세는 기준과 같게 UTC 자정(한국시간 오전 9시)부터다.
 */

export const PRICE_KEYS = ['price_main_in', 'price_main_out', 'price_cheap_in', 'price_cheap_out', 'usd_krw'] as const
export type PriceKey = (typeof PRICE_KEYS)[number]
export type PriceSettings = Partial<Record<PriceKey, number>>

type TokenPair = { input: number; output: number }
type Window = 'today' | 'd7' | 'd30'
type ModelClass = 'main' | 'cheap'
type PurposeGroup = 'teacher' | 'student' | 'summary'

export type UsageWindowSummary = {
  total: number
  input: number
  output: number
  teacher: number
  student: number
  summary: number
  estimatedCostUsd: number | null
}

export type DayUsageRow = { date: string; total: number; teacher: number; student: number; summary: number }

export type RoomOpsRow = {
  id: string
  name: string
  level: string
  interest: string
  approved: number
  maxMembers: number
  pending: number
  activeAiStudents: number
  lastActivityAt: string | null
  todayMessages: number
  todayAiMessages: number
  capReached: boolean
  tokensToday: number
  tokens7d: number
  tokens30d: number
}

export type SafetyEvent = { createdAt: string; roomName: string; purpose: string; reason: string }

export type AdminStats = {
  usage: Record<Window, UsageWindowSummary>
  priceSettings: PriceSettings
  pricesComplete: boolean
  budget: { used: number; limit: number | null; percent: number | null; level: 'ok' | 'warn' | 'exceeded' }
  byDay: DayUsageRow[]
  rooms: RoomOpsRow[]
  roomCapPerDay: number
  members: {
    total: number
    byLevel: { beginner: number; intermediate: number; advanced: number; unset: number }
    onboardingDone: number
    onboardingRate: number | null
    avgProgressPercent: number | null
    activeLast7d: number | null
    activeLast30d: number | null
    lastLoginAvailable: boolean
  }
  safety: {
    available: boolean
    today: number
    d7: number
    d30: number
    byRoom: Array<{ roomName: string; count: number }>
    recent: SafetyEvent[]
  }
  notes: string[]
}

const MAX_ROWS = 20000
const PAGE = 1000

/** Supabase는 한 번에 1000행까지만 주므로 페이지를 나눠 모두 가져온다. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) return { rows, error: error.message }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return { rows, error: null }
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function purposeGroup(purpose: string): PurposeGroup {
  if (purpose === 'ai_student_reply') return 'student'
  if (purpose === 'summary') return 'summary'
  return 'teacher' // ai_teacher_reply, welcome, clarification
}

function emptyWindow(): UsageWindowSummary {
  return { total: 0, input: 0, output: 0, teacher: 0, student: 0, summary: 0, estimatedCostUsd: null }
}

type UsageRow = {
  room_id: string
  usage_date: string
  purpose: string
  model: string
  input_tokens: number | null
  output_tokens: number | null
}

export async function loadAdminStats(): Promise<AdminStats> {
  const db = getDb()
  const notes: string[] = []

  const startToday = new Date()
  startToday.setUTCHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  const todayStr = dateStr(startToday)
  const start7Str = dateStr(new Date(startToday.getTime() - 6 * dayMs))
  const start30Str = dateStr(new Date(startToday.getTime() - 29 * dayMs))
  const start30Iso = new Date(startToday.getTime() - 29 * dayMs).toISOString()
  const start7Iso = new Date(startToday.getTime() - 6 * dayMs).toISOString()

  const [roomsRes, membersRes, studentsRes, usageRes, todayMsgRes, settingsRes] = await Promise.all([
    db.from('study_rooms').select('id, name, level, interest, max_members').order('created_at', { ascending: true }),
    fetchAll<{ room_id: string; status: string }>((f, t) =>
      db.from('room_members').select('room_id, status').range(f, t),
    ),
    db.from('ai_students').select('room_id, is_active'),
    fetchAll<UsageRow>((f, t) =>
      db
        .from('ai_usage_log')
        .select('room_id, usage_date, purpose, model, input_tokens, output_tokens')
        .gte('usage_date', start30Str)
        .range(f, t),
    ),
    fetchAll<{ room_id: string; sender_type: string }>((f, t) =>
      db.from('room_messages').select('room_id, sender_type').gte('created_at', startToday.toISOString()).range(f, t),
    ),
    db.from('admin_settings').select('key, value'),
  ])

  if (usageRes.error) notes.push('토큰 사용 기록을 불러오지 못했어요.')
  if (usageRes.rows.length >= MAX_ROWS) notes.push('사용 기록이 너무 많아 일부만 집계됐어요.')

  // ---- 단가 설정 ----
  const priceSettings: PriceSettings = {}
  if (settingsRes.error) {
    notes.push('단가 설정 테이블이 아직 없어요. SQL 3-9를 실행하면 단가를 저장할 수 있어요.')
  } else {
    for (const row of (settingsRes.data ?? []) as Array<{ key: string; value: number | string }>) {
      if ((PRICE_KEYS as readonly string[]).includes(row.key)) {
        const n = Number(row.value)
        if (Number.isFinite(n)) priceSettings[row.key as PriceKey] = n
      }
    }
  }
  const pricesComplete =
    priceSettings.price_main_in !== undefined &&
    priceSettings.price_main_out !== undefined &&
    priceSettings.price_cheap_in !== undefined &&
    priceSettings.price_cheap_out !== undefined

  // ---- A. 비용/사용량 ----
  const usage: Record<Window, UsageWindowSummary> = { today: emptyWindow(), d7: emptyWindow(), d30: emptyWindow() }
  const classTokens: Record<Window, Record<ModelClass, TokenPair>> = {
    today: { main: { input: 0, output: 0 }, cheap: { input: 0, output: 0 } },
    d7: { main: { input: 0, output: 0 }, cheap: { input: 0, output: 0 } },
    d30: { main: { input: 0, output: 0 }, cheap: { input: 0, output: 0 } },
  }
  const dayMap = new Map<string, DayUsageRow>()
  for (let i = 0; i < 14; i++) {
    const d = dateStr(new Date(startToday.getTime() - i * dayMs))
    dayMap.set(d, { date: d, total: 0, teacher: 0, student: 0, summary: 0 })
  }
  const roomTokens = new Map<string, { today: number; d7: number; d30: number }>()

  for (const row of usageRes.rows) {
    const input = row.input_tokens ?? 0
    const output = row.output_tokens ?? 0
    const total = input + output
    const group = purposeGroup(row.purpose)
    const cls: ModelClass = row.model === MAIN_MODEL ? 'main' : 'cheap'
    const windows: Window[] = ['d30']
    if (row.usage_date >= start7Str) windows.push('d7')
    if (row.usage_date === todayStr) windows.push('today')

    for (const w of windows) {
      usage[w].total += total
      usage[w].input += input
      usage[w].output += output
      usage[w][group] += total
      classTokens[w][cls].input += input
      classTokens[w][cls].output += output
    }

    const rt = roomTokens.get(row.room_id) ?? { today: 0, d7: 0, d30: 0 }
    rt.d30 += total
    if (row.usage_date >= start7Str) rt.d7 += total
    if (row.usage_date === todayStr) rt.today += total
    roomTokens.set(row.room_id, rt)

    const day = dayMap.get(row.usage_date)
    if (day) {
      day.total += total
      day[group] += total
    }
  }

  if (pricesComplete) {
    for (const w of ['today', 'd7', 'd30'] as Window[]) {
      const c = classTokens[w]
      usage[w].estimatedCostUsd =
        (c.main.input / 1e6) * (priceSettings.price_main_in as number) +
        (c.main.output / 1e6) * (priceSettings.price_main_out as number) +
        (c.cheap.input / 1e6) * (priceSettings.price_cheap_in as number) +
        (c.cheap.output / 1e6) * (priceSettings.price_cheap_out as number)
    }
  }

  const dailyBudget = Number(process.env.AI_DAILY_TOKEN_BUDGET)
  const limit = Number.isFinite(dailyBudget) && dailyBudget > 0 ? dailyBudget : null
  const percent = limit ? (usage.today.total / limit) * 100 : null
  const budget = {
    used: usage.today.total,
    limit,
    percent,
    level: (percent === null ? 'ok' : percent >= 100 ? 'exceeded' : percent >= 80 ? 'warn' : 'ok') as
      | 'ok'
      | 'warn'
      | 'exceeded',
  }

  // ---- B. 방 운영 ----
  const roomList = (roomsRes.data ?? []) as Array<{
    id: string
    name: string
    level: string
    interest: string
    max_members: number
  }>
  const approved = new Map<string, number>()
  const pending = new Map<string, number>()
  for (const m of membersRes.rows) {
    const target = m.status === 'approved' ? approved : m.status === 'pending' ? pending : null
    if (target) target.set(m.room_id, (target.get(m.room_id) ?? 0) + 1)
  }
  const activeStudents = new Map<string, number>()
  for (const s of (studentsRes.data ?? []) as Array<{ room_id: string; is_active: boolean }>) {
    if (s.is_active) activeStudents.set(s.room_id, (activeStudents.get(s.room_id) ?? 0) + 1)
  }
  const todayMessages = new Map<string, number>()
  const todayAiMessages = new Map<string, number>()
  for (const m of todayMsgRes.rows) {
    todayMessages.set(m.room_id, (todayMessages.get(m.room_id) ?? 0) + 1)
    if (m.sender_type !== 'member') todayAiMessages.set(m.room_id, (todayAiMessages.get(m.room_id) ?? 0) + 1)
  }
  const lastActivity = await Promise.all(
    roomList.map(async (room) => {
      const { data } = await db
        .from('room_messages')
        .select('created_at')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1)
      return (data?.[0]?.created_at as string | undefined) ?? null
    }),
  )

  const rooms: RoomOpsRow[] = roomList.map((room, i) => {
    const tokens = roomTokens.get(room.id) ?? { today: 0, d7: 0, d30: 0 }
    const aiToday = todayAiMessages.get(room.id) ?? 0
    return {
      id: room.id,
      name: room.name,
      level: room.level,
      interest: room.interest,
      approved: approved.get(room.id) ?? 0,
      maxMembers: room.max_members,
      pending: pending.get(room.id) ?? 0,
      activeAiStudents: activeStudents.get(room.id) ?? 0,
      lastActivityAt: lastActivity[i],
      todayMessages: todayMessages.get(room.id) ?? 0,
      todayAiMessages: aiToday,
      capReached: aiToday >= AI_DAILY_ROOM_MESSAGE_LIMIT,
      tokensToday: tokens.today,
      tokens7d: tokens.d7,
      tokens30d: tokens.d30,
    }
  })

  // ---- C. 회원 학습 요약 ----
  let lastLoginAvailable = true
  let userRows: Array<{ id: string; ai_level: string | null; onboarding_done: boolean; last_login_at?: string | null }> = []
  const withLogin = await fetchAll<{
    id: string
    ai_level: string | null
    onboarding_done: boolean
    last_login_at: string | null
  }>((f, t) => db.from('users').select('id, ai_level, onboarding_done, last_login_at').range(f, t))
  if (withLogin.error) {
    lastLoginAvailable = false
    notes.push('최근 접속일은 SQL 3-9를 실행하면 집계돼요.')
    const plain = await fetchAll<{ id: string; ai_level: string | null; onboarding_done: boolean }>((f, t) =>
      db.from('users').select('id, ai_level, onboarding_done').range(f, t),
    )
    userRows = plain.rows
  } else {
    userRows = withLogin.rows
  }

  const progressRes = await fetchAll<{ user_id: string }>((f, t) =>
    db.from('curriculum_progress').select('user_id').range(f, t),
  )
  const doneByUser = new Map<string, number>()
  for (const p of progressRes.rows) doneByUser.set(p.user_id, (doneByUser.get(p.user_id) ?? 0) + 1)
  const totalSubtopics =
    getOrderedSubtopicIds('beginner').length +
    getOrderedSubtopicIds('intermediate').length +
    getOrderedSubtopicIds('advanced').length

  const byLevel = { beginner: 0, intermediate: 0, advanced: 0, unset: 0 }
  let onboardingDone = 0
  let progressSum = 0
  let active7 = 0
  let active30 = 0
  for (const u of userRows) {
    if (u.ai_level === 'beginner' || u.ai_level === 'intermediate' || u.ai_level === 'advanced') {
      byLevel[u.ai_level] += 1
    } else {
      byLevel.unset += 1
    }
    if (u.onboarding_done) onboardingDone += 1
    if (totalSubtopics > 0) progressSum += Math.min(1, (doneByUser.get(u.id) ?? 0) / totalSubtopics)
    if (lastLoginAvailable && u.last_login_at) {
      if (u.last_login_at >= start7Iso) active7 += 1
      if (u.last_login_at >= start30Iso) active30 += 1
    }
  }
  const memberTotal = userRows.length
  const members = {
    total: memberTotal,
    byLevel,
    onboardingDone,
    onboardingRate: memberTotal ? (onboardingDone / memberTotal) * 100 : null,
    avgProgressPercent: memberTotal && totalSubtopics ? (progressSum / memberTotal) * 100 : null,
    activeLast7d: lastLoginAvailable ? active7 : null,
    activeLast30d: lastLoginAvailable ? active30 : null,
    lastLoginAvailable,
  }

  // ---- D. 안전 모니터링 ----
  const safetyRes = await fetchAll<{ room_id: string | null; purpose: string; reason: string; created_at: string }>(
    (f, t) =>
      db
        .from('ai_safety_log')
        .select('room_id, purpose, reason, created_at')
        .gte('created_at', start30Iso)
        .order('created_at', { ascending: false })
        .range(f, t),
  )
  const roomNameById = new Map(roomList.map((r) => [r.id, r.name]))
  const safety: AdminStats['safety'] = {
    available: !safetyRes.error,
    today: 0,
    d7: 0,
    d30: 0,
    byRoom: [],
    recent: [],
  }
  if (safetyRes.error) {
    notes.push('안전 차단 기록은 SQL 3-9를 실행하면 쌓이기 시작해요.')
  } else {
    const perRoom = new Map<string, number>()
    for (const e of safetyRes.rows) {
      safety.d30 += 1
      if (e.created_at >= start7Iso) safety.d7 += 1
      if (e.created_at >= startToday.toISOString()) safety.today += 1
      const name = e.room_id ? (roomNameById.get(e.room_id) ?? '삭제된 방') : '알 수 없는 방'
      perRoom.set(name, (perRoom.get(name) ?? 0) + 1)
    }
    safety.byRoom = Array.from(perRoom, ([roomName, count]) => ({ roomName, count })).sort((a, b) => b.count - a.count)
    safety.recent = safetyRes.rows.slice(0, 10).map((e) => ({
      createdAt: e.created_at,
      roomName: e.room_id ? (roomNameById.get(e.room_id) ?? '삭제된 방') : '알 수 없는 방',
      purpose: e.purpose,
      reason: e.reason,
    }))
  }

  return {
    usage,
    priceSettings,
    pricesComplete,
    budget,
    byDay: Array.from(dayMap.values()),
    rooms,
    roomCapPerDay: AI_DAILY_ROOM_MESSAGE_LIMIT,
    members,
    safety,
    notes,
  }
}
