'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error ?? '임시 비밀번호 발송에 실패했어요.' })
        return
      }
      setMessage({ type: 'success', text: '이메일로 임시 비밀번호를 발송했습니다.' })
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">비밀번호 찾기</h1>
        <p className="text-slate-500 text-sm mb-8">가입 시 등록한 이메일로 임시 비밀번호를 보내드려요.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
            />
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {isLoading ? '발송 중...' : '임시 비밀번호 발송'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/login" className="text-primary-600 font-medium hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  )
}
