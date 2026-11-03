'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type ChatMessage = {
  id: string
  userId: string | null
  senderType: 'member' | 'ai_teacher'
  nickname: string
  content: string
  createdAt: string
}

type Props = {
  roomId: string
  currentUserId: string
}

const POLL_INTERVAL_MS = 3000
const MAX_LENGTH = 500
const NEAR_BOTTOM_THRESHOLD_PX = 120

export default function RoomChat({ roomId, currentUserId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastCreatedAtRef = useRef<string | null>(null)
  const isNearBottomRef = useRef(true)

  const fetchMessages = useCallback(
    async (after: string | null) => {
      try {
        const url = after
          ? `/api/group/${roomId}/messages?after=${encodeURIComponent(after)}`
          : `/api/group/${roomId}/messages`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        const incoming: ChatMessage[] = Array.isArray(data?.messages) ? data.messages : []
        if (incoming.length === 0) return

        setMessages((prev) => (after ? [...prev, ...incoming] : incoming))
        lastCreatedAtRef.current = incoming[incoming.length - 1].createdAt
      } catch {
        // polling 실패는 조용히 무시하고 다음 주기에 재시도한다
      }
    },
    [roomId],
  )

  useEffect(() => {
    fetchMessages(null).finally(() => setLoaded(true))
  }, [fetchMessages])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return
      fetchMessages(lastCreatedAtRef.current)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

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

    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/group/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '메시지를 보내지 못했어요.')
        return
      }
      setInput('')
      isNearBottomRef.current = true
      if (data?.message) {
        setMessages((prev) => [...prev, data.message])
        lastCreatedAtRef.current = data.message.createdAt
      }
    } catch {
      setError('네트워크 오류가 발생했어요.')
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
        {loaded && messages.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">아직 대화가 없어요. 잠시만 기다려주세요 🤖</p>
        )}
        {messages.map((m) => {
          const isMine = m.senderType === 'member' && m.userId === currentUserId
          const isAi = m.senderType === 'ai_teacher'
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
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
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isMine
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : isAi
                        ? 'bg-primary-50 text-slate-800 border border-primary-100 rounded-bl-sm'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

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
