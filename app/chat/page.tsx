'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type CurriculumCta = {
  nickname: string
  level: 'beginner' | 'intermediate' | 'advanced'
}

const ONBOARDING_GREETING = '안녕하세요! 저는 AI쌤이에요 😊 어떤 일을 하고 계세요?'

const levelMeta: Record<CurriculumCta['level'], { emoji: string; label: string }> = {
  beginner: { emoji: '🌱', label: '초급' },
  intermediate: { emoji: '🚀', label: '중급' },
  advanced: { emoji: '⚡', label: '고급' },
}

const suggestions = [
  '머신러닝이 뭔가요? 쉽게 설명해주세요.',
  '파이썬을 처음 배우는데 어디서 시작하면 좋을까요?',
  '딥러닝과 머신러닝의 차이가 뭔가요?',
  'ChatGPT 같은 AI는 어떻게 만드나요?',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [curriculumCta, setCurriculumCta] = useState<CurriculumCta | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((res) => res.json()).catch(() => ({ user: null })),
      fetch('/api/chat/history').then((res) => res.json()).catch(() => ({ messages: [] })),
    ]).then(([meData, historyData]) => {
      const user = meData?.user ?? null
      const history: Message[] = Array.isArray(historyData?.messages) ? historyData.messages : []

      if (user && user.onboardingDone === false) {
        setIsOnboarding(true)
        setMessages([{ role: 'assistant', content: ONBOARDING_GREETING }, ...history])
      } else if (history.length > 0) {
        setMessages(history)
      }
    }).finally(() => setHistoryLoaded(true))
  }, [])

  const sendOnboardingMessage = async (newMessages: Message[]) => {
    try {
      const res = await fetch('/api/chat/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data?.error ?? '죄송해요, 오류가 발생했어요.' }])
        return
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])

      if (data.done) {
        setIsOnboarding(false)
        const meRes = await fetch('/api/auth/me').then((r) => r.json()).catch(() => null)
        const nickname = meRes?.user?.nickname ?? '회원'
        setCurriculumCta({ nickname, level: data.level ?? 'beginner' })
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.' }])
    }
  }

  const sendChatMessage = async (newMessages: Message[]) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) {
        let serverMessage = ''
        try {
          const errBody = await res.json()
          serverMessage = errBody?.error ?? ''
        } catch {
          // 서버가 JSON이 아닌 응답을 준 경우 무시하고 기본 메시지 사용
        }
        throw new Error(serverMessage || 'API 오류가 발생했습니다.')
      }

      if (!res.body) throw new Error('서버 응답을 받지 못했어요.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : '죄송해요, 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
      setMessages((prev) => {
        const updated = [...prev]
        if (updated[updated.length - 1]?.role === 'assistant' && updated[updated.length - 1].content === '') {
          updated[updated.length - 1] = { role: 'assistant', content: message }
          return updated
        }
        return [...updated, { role: 'assistant', content: message }]
      })
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      if (isOnboarding) {
        await sendOnboardingMessage(newMessages)
      } else {
        await sendChatMessage(newMessages)
      }
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-xl">🤖</div>
          <div>
            <h1 className="font-bold text-slate-800">AI쌤</h1>
            <p className="text-xs text-slate-500">
              {isOnboarding ? '첫 만남이에요! 몇 가지만 물어볼게요' : 'AI · ML · DL 무엇이든 물어보세요 · Powered by Claude'}
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-secondary-600 bg-secondary-50 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 inline-block animate-pulse" />
            {isOnboarding ? '온보딩 중' : '온라인'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && historyLoaded && (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">🤖</div>
              <h2 className="text-xl font-bold text-slate-700 mb-2">안녕하세요! AI쌤이에요 👋</h2>
              <p className="text-slate-500 mb-8">AI에 관한 어떤 질문도 환영해요. 아래에서 시작해보세요!</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left p-4 bg-white border border-slate-200 hover:border-primary-300 hover:bg-primary-50 rounded-xl text-sm text-slate-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-base mr-3 flex-shrink-0 mt-1">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm shadow-sm'
                }`}
              >
                {msg.content || (
                  <span className="flex gap-1 items-center py-1">
                    <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
                    <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
                    <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
                  </span>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-base mr-3 flex-shrink-0">
                🤖
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <span className="flex gap-1 items-center">
                  <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
                  <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
                  <span className="typing-dot w-2 h-2 bg-slate-400 rounded-full inline-block" />
                </span>
              </div>
            </div>
          )}

          {curriculumCta && (
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100 rounded-2xl p-5 text-center">
              <p className="font-bold text-slate-800 mb-1">
                {curriculumCta.nickname}님 맞춤 커리큘럼을 준비했어요! 🎉
              </p>
              <p className="text-sm text-slate-500 mb-4">
                {levelMeta[curriculumCta.level].emoji} {levelMeta[curriculumCta.level].label} 단계부터 시작해보세요.
              </p>
              <Link
                href={`/curriculum?level=${curriculumCta.level}`}
                className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                내 커리큘럼 보러가기 →
              </Link>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-100 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AI에 대해 궁금한 게 있으신가요? (Shift+Enter로 줄바꿈)"
            rows={1}
            className="flex-1 resize-none border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors max-h-32 overflow-y-auto"
            style={{ minHeight: '48px' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="max-w-3xl mx-auto mt-2 text-xs text-slate-400 text-center">
          AI쌤은 Claude AI를 기반으로 합니다. 답변이 항상 완벽하지 않을 수 있으니 참고용으로 활용하세요.
        </p>
      </div>
    </div>
  )
}
