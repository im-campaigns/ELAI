'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import ChatMarkdown from './ChatMarkdown'

type ChatMessage = {
  id: string
  userId: string | null
  senderType: 'member' | 'ai_teacher' | 'ai_student'
  nickname: string
  content: string
  createdAt: string
  visibleAt: string
}

type Props = {
  roomId: string
  currentUserId: string
}

// Realtime이 "구독됨" 상태를 보고해도 실제로 이벤트가 안 오는 경우가 있어(원인 불명,
// 콘솔 로그로 계속 관찰 중), realtime 상태를 믿고 polling을 완전히 끄지 않는다.
// 평소엔 느슨하게, 내가 AI쌤을 트리거할 만한 메시지를 보낸 직후에는 빠르게 확인한다.
const IDLE_POLL_INTERVAL_MS = 10000
const FAST_POLL_INTERVAL_MS = 3000
const FAST_POLL_DURATION_MS = 60000
const MAX_LENGTH = 500
const NEAR_BOTTOM_THRESHOLD_PX = 120
const AI_TYPING_TIMEOUT_MS = 20000
const REALTIME_TOKEN_REFRESH_MS = 4 * 60 * 1000

// 서버의 shouldAiReply()와 동일한 간단한 규칙으로, 전송 직후 "AI쌤이 입력 중…" 표시를 보여줄지 판단한다.
function looksLikeAiTrigger(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (trimmed.includes('AI쌤')) return true
  return trimmed.endsWith('?') || trimmed.endsWith('？')
}

let realtimeClient: SupabaseClient | null = null
function getRealtimeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  if (!realtimeClient) {
    realtimeClient = createClient(url, anonKey, { auth: { persistSession: false } })
  }
  return realtimeClient
}

export default function RoomChat({ roomId, currentUserId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitNotice, setLimitNotice] = useState<string | null>(null)
  const [aiTyping, setAiTyping] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [realtimeActive, setRealtimeActive] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastVisibleAtRef = useRef<string | null>(null)
  const isNearBottomRef = useRef(true)
  const realtimeActiveRef = useRef(false)
  const aiTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pollingRef = useRef(false)

  const fastPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fastPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopFastPolling = useCallback(() => {
    if (fastPollIntervalRef.current) {
      clearInterval(fastPollIntervalRef.current)
      fastPollIntervalRef.current = null
    }
    if (fastPollTimeoutRef.current) {
      clearTimeout(fastPollTimeoutRef.current)
      fastPollTimeoutRef.current = null
    }
  }, [])

  const hideAiTyping = useCallback(() => {
    setAiTyping(false)
    if (aiTypingTimeoutRef.current) {
      clearTimeout(aiTypingTimeoutRef.current)
      aiTypingTimeoutRef.current = null
    }
    stopFastPolling()
  }, [stopFastPolling])

  const showAiTyping = useCallback(() => {
    setAiTyping(true)
    if (aiTypingTimeoutRef.current) clearTimeout(aiTypingTimeoutRef.current)
    aiTypingTimeoutRef.current = setTimeout(() => setAiTyping(false), AI_TYPING_TIMEOUT_MS)
  }, [])

  // 같은 메시지가 화면에 두 번 붙지 않도록 id 기준으로 합치고 visible_at(표시 시각) 순으로 정렬한다.
  // (폴링과 전송 응답이 겹치면 같은 메시지가 여러 번 들어와 AI쌤이 반복해서 말하는 것처럼 보였다)
  const mergeMessages = useCallback(
    (incoming: ChatMessage[], replace = false) => {
      if (incoming.length === 0) return
      setMessages((prev) => {
        const map = new Map<string, ChatMessage>()
        for (const m of replace ? [] : prev) map.set(m.id, m)
        for (const m of incoming) map.set(m.id, m)
        return Array.from(map.values()).sort(
          (a, b) => new Date(a.visibleAt).getTime() - new Date(b.visibleAt).getTime(),
        )
      })
      for (const m of incoming) {
        const cur = lastVisibleAtRef.current
        if (!cur || new Date(m.visibleAt).getTime() > new Date(cur).getTime()) {
          lastVisibleAtRef.current = m.visibleAt
        }
      }
      if (incoming.some((m) => m.senderType === 'ai_teacher')) {
        hideAiTyping()
      }
    },
    [hideAiTyping],
  )

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const fetchMessages = useCallback(
    async (after: string | null) => {
      // realtime "구독됨" 상태만 믿고 polling을 끄면, 구독은 됐는데 이벤트가 안 오는
      // 경우(원인 불명) 화면이 영영 안 갱신된다. 그래서 realtime 상태와 상관없이 항상 polling한다.
      // 이전 polling이 아직 끝나지 않았으면 겹쳐서 요청하지 않는다.
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        const url = after
          ? `/api/group/${roomId}/messages?after=${encodeURIComponent(after)}`
          : `/api/group/${roomId}/messages`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        const incoming: ChatMessage[] = Array.isArray(data?.messages) ? data.messages : []
        if (!after && typeof data?.hasMore === 'boolean') {
          setHasMoreOlder(data.hasMore)
        }
        mergeMessages(incoming, !after)
      } catch {
        // polling 실패는 조용히 무시하고 다음 주기에 재시도한다
      } finally {
        pollingRef.current = false
      }
    },
    [roomId, mergeMessages],
  )

  // 메시지를 보낸 뒤(특히 AI쌤을 트리거할 만한 메시지) 최대 60초 동안 3초 간격으로 빠르게
  // 확인한다. realtime이 실패하거나 조용히 멈춰도 답이 반드시 화면에 뜨도록 하는 안전장치.
  const startFastPolling = useCallback(() => {
    stopFastPolling()
    fastPollIntervalRef.current = setInterval(() => {
      fetchMessages(lastVisibleAtRef.current)
    }, FAST_POLL_INTERVAL_MS)
    fastPollTimeoutRef.current = setTimeout(stopFastPolling, FAST_POLL_DURATION_MS)
  }, [fetchMessages, stopFastPolling])

  const loadOlder = useCallback(async () => {
    if (loadingOlder || messages.length === 0) return
    const oldest = messages[0]?.visibleAt
    if (!oldest) return
    setLoadingOlder(true)
    try {
      const res = await fetch(`/api/group/${roomId}/messages?before=${encodeURIComponent(oldest)}`)
      if (!res.ok) return
      const data = await res.json()
      const older: ChatMessage[] = Array.isArray(data?.messages) ? data.messages : []
      setHasMoreOlder(Boolean(data?.hasMore))
      if (older.length === 0) return

      const el = listRef.current
      const prevScrollHeight = el?.scrollHeight ?? 0
      setMessages((prev) => {
        const map = new Map<string, ChatMessage>()
        for (const m of older) map.set(m.id, m)
        for (const m of prev) map.set(m.id, m)
        return Array.from(map.values()).sort(
          (a, b) => new Date(a.visibleAt).getTime() - new Date(b.visibleAt).getTime(),
        )
      })
      // 스크롤 위치 보정: 위에 메시지가 끼워진 만큼 scrollTop도 같이 밀어줘야 화면이 안 튄다.
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - prevScrollHeight
      })
    } finally {
      setLoadingOlder(false)
    }
  }, [roomId, messages, loadingOlder])

  useEffect(() => {
    // 방 입장 시 한 번만 호출: AI쌤 환영 인사 생성을 /messages 폴링과 분리한다.
    fetch(`/api/group/${roomId}/welcome`, { method: 'POST' }).catch(() => {})
  }, [roomId])

  useEffect(() => {
    fetchMessages(null).finally(() => setLoaded(true))
  }, [fetchMessages])

  // Supabase Realtime 구독: 서버가 승인된 멤버십을 확인한 뒤 해당 room_id만 읽을 수 있는
  // 단기 토큰을 발급해주고(그 방이 아니면 RLS가 막는다), 그 토큰으로 room_messages insert를
  // 구독한다. 지연 표시(visible_at이 미래)인 메시지는 그 시각이 될 때까지 화면에 안 보이게
  // 타이머로 늦춘다(AI 학생/보정 메시지의 "사람처럼 시차" 효과를 realtime에서도 유지).
  useEffect(() => {
    const maybeClient = getRealtimeClient()
    if (!maybeClient) {
      console.warn('[realtime] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY가 없어 polling만 사용합니다.')
      return
    }
    const client = maybeClient

    let cancelled = false
    let channel: RealtimeChannel | null = null
    let refreshTimer: ReturnType<typeof setInterval> | null = null
    const revealTimers = new Set<ReturnType<typeof setTimeout>>()

    async function fetchToken(): Promise<string | null> {
      try {
        const res = await fetch(`/api/group/${roomId}/realtime-token`, { method: 'POST' })
        if (!res.ok) {
          console.error('[realtime] 토큰 발급 실패, status=', res.status)
          return null
        }
        const data = await res.json()
        const token = typeof data?.token === 'string' ? data.token : null
        console.log('[realtime] 토큰 발급', token ? '성공' : '실패(응답에 token 없음)', 'expiresIn=', data?.expiresIn)
        return token
      } catch (err) {
        console.error('[realtime] 토큰 요청 네트워크 오류:', err)
        return null
      }
    }

    function revealWhenVisible(message: ChatMessage) {
      const delay = new Date(message.visibleAt).getTime() - Date.now()
      if (delay <= 0) {
        mergeMessages([message])
        return
      }
      const timer = setTimeout(() => {
        revealTimers.delete(timer)
        mergeMessages([message])
      }, delay)
      revealTimers.add(timer)
    }

    async function connect() {
      const token = await fetchToken()
      if (cancelled) return
      if (!token) {
        setRealtimeActive(false)
        return
      }
      client.realtime.setAuth(token)
      channel = client
        .channel(`room-messages-${roomId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
          (payload) => {
            console.log('[realtime] INSERT 이벤트 수신:', payload.new)
            const row = payload.new as Record<string, unknown>
            revealWhenVisible({
              id: row.id as string,
              userId: (row.user_id as string | null) ?? null,
              senderType: row.sender_type as ChatMessage['senderType'],
              nickname: row.nickname as string,
              content: row.content as string,
              createdAt: row.created_at as string,
              visibleAt: row.visible_at as string,
            })
          },
        )
        .subscribe((status, err) => {
          console.log('[realtime] 구독 상태 변경:', status, err ?? '')
          if (cancelled) return
          const active = status === 'SUBSCRIBED'
          realtimeActiveRef.current = active
          setRealtimeActive(active)
        })
    }

    connect()
    // 토큰이 5분 만료이므로 만료 전에 재발급받아 realtime 인증을 갱신한다.
    refreshTimer = setInterval(async () => {
      const token = await fetchToken()
      if (token && !cancelled) client.realtime.setAuth(token)
    }, REALTIME_TOKEN_REFRESH_MS)

    return () => {
      cancelled = true
      realtimeActiveRef.current = false
      if (refreshTimer) clearInterval(refreshTimer)
      revealTimers.forEach((timer) => clearTimeout(timer))
      if (channel) client.removeChannel(channel)
    }
  }, [roomId, mergeMessages])

  // 평소 기본 polling(10초 간격). realtime이 보조로 더 빠르게 갱신해줄 수 있지만,
  // 이 polling은 realtime 상태와 상관없이 항상 돈다.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return
      fetchMessages(lastVisibleAtRef.current)
    }, IDLE_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => stopFastPolling, [stopFastPolling])

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, aiTyping])

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX
  }

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || sending) return
    if (content.length > MAX_LENGTH) {
      setError(`메시지는 ${MAX_LENGTH}자 이내로 입력해주세요.`)
      return
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const now = new Date().toISOString()

    setSending(true)
    setError(null)
    setLimitNotice(null)
    setInput('')
    isNearBottomRef.current = true
    // 서버 응답을 기다리지 않고 바로 화면에 보여준다(optimistic UI).
    mergeMessages([
      { id: tempId, userId: currentUserId, senderType: 'member', nickname: '나', content, createdAt: now, visibleAt: now },
    ])
    if (looksLikeAiTrigger(content)) {
      showAiTyping()
      startFastPolling()
    }

    try {
      const res = await fetch(`/api/group/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '메시지를 보내지 못했어요.')
        removeMessage(tempId)
        hideAiTyping()
        return
      }
      removeMessage(tempId)
      if (data?.message) {
        mergeMessages([data.message])
      }
      if (data?.aiLimited) {
        hideAiTyping()
        setLimitNotice(data.aiLimitedMessage ?? '잠시 후 다시 질문해 주세요.')
        setTimeout(() => setLimitNotice(null), 5000)
      }
    } catch {
      setError('네트워크 오류가 발생했어요.')
      removeMessage(tempId)
      hideAiTyping()
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loaded && hasMoreOlder && (
          <div className="flex justify-center pb-2">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 px-3 py-1.5 rounded-full transition-colors"
            >
              {loadingOlder ? '불러오는 중…' : '이전 대화 보기'}
            </button>
          </div>
        )}
        {loaded && messages.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">아직 대화가 없어요. 잠시만 기다려주세요 🤖</p>
        )}
        {messages.map((m) => {
          const isPending = m.id.startsWith('temp-')
          const isMine = m.senderType === 'member' && m.userId === currentUserId
          const isAi = m.senderType === 'ai_teacher'
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${isPending ? 'opacity-60' : ''}`}>
              <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {isAi ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-primary-600 rounded-full px-2 py-0.5">
                      🤖 AI쌤
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">{m.nickname}</span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : isAi
                        ? 'bg-primary-50 text-slate-800 border border-primary-100 rounded-bl-sm'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'
                  }`}
                >
                  <ChatMarkdown content={m.content} />
                </div>
              </div>
            </div>
          )
        })}
        {aiTyping && (
          <div className="flex justify-start">
            <div className="max-w-[75%] flex flex-col items-start">
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-primary-600 rounded-full px-2 py-0.5">
                  🤖 AI쌤
                </span>
                <span className="text-[11px] text-slate-400">입력 중…</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-primary-50 border border-primary-100 rounded-bl-sm">
                <span className="flex gap-1 items-center py-0.5">
                  <span className="typing-dot w-1.5 h-1.5 bg-primary-400 rounded-full inline-block" />
                  <span className="typing-dot w-1.5 h-1.5 bg-primary-400 rounded-full inline-block" />
                  <span className="typing-dot w-1.5 h-1.5 bg-primary-400 rounded-full inline-block" />
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {limitNotice && (
        <p className="px-4 pb-1 text-xs text-amber-600">{limitNotice}</p>
      )}
      {error && <p className="px-4 pb-1 text-xs text-red-500">{error}</p>}

      <div className="border-t border-slate-100 bg-white px-4 py-3">
        <p className="text-xs text-slate-400 mb-2">
          전화번호, 주소, 계좌 같은 개인정보는 올리지 마세요. AI쌤이 함께 진행하는 방이에요.
        </p>
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요 (Enter로 전송)"
            rows={1}
            maxLength={MAX_LENGTH}
            disabled={sending}
            className="flex-1 resize-none border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors max-h-28 overflow-y-auto"
            style={{ minHeight: '44px' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 112) + 'px'
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl transition-colors flex-shrink-0 text-sm font-semibold"
          >
            보내기
          </button>
        </div>
      </div>
    </div>
  )
}
