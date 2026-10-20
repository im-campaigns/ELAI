'use client'

import { useState } from 'react'

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않아요.' })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error ?? '비밀번호 변경에 실패했어요.' })
        return
      }
      setMessage({ type: 'success', text: '비밀번호가 변경되었습니다.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했어요.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
      <h2 className="font-bold text-slate-800 mb-4">비밀번호 변경</h2>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">현재 비밀번호</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">새 비밀번호</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">새 비밀번호 확인</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
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
          className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
          {isLoading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  )
}
