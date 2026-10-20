'use client'

import { useState } from 'react'

type AdminUser = {
  id: string
  nickname: string
  email: string | null
  createdAt: string
  progress: {
    beginner: string
    intermediate: string
    advanced: string
  }
}

type Props = {
  users: AdminUser[]
}

export default function AdminUserTable({ users }: Props) {
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleReset = async (user: AdminUser) => {
    setResettingId(user.id)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error ?? '비밀번호 초기화에 실패했어요.' })
        return
      }
      setMessage({ type: 'success', text: `${data.nickname}님 비밀번호가 ${data.tempPassword}로 초기화됐습니다` })
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했어요.' })
    } finally {
      setResettingId(null)
    }
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-5 py-3 font-semibold">닉네임</th>
              <th className="px-5 py-3 font-semibold">이메일</th>
              <th className="px-5 py-3 font-semibold">가입일</th>
              <th className="px-5 py-3 font-semibold">초급 진도</th>
              <th className="px-5 py-3 font-semibold">중급 진도</th>
              <th className="px-5 py-3 font-semibold">고급 진도</th>
              <th className="px-5 py-3 font-semibold">계정 관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-700">{u.nickname}</td>
                <td className="px-5 py-3 text-slate-500">{u.email ?? '—'}</td>
                <td className="px-5 py-3 text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-5 py-3 text-slate-600">{u.progress.beginner}</td>
                <td className="px-5 py-3 text-slate-600">{u.progress.intermediate}</td>
                <td className="px-5 py-3 text-slate-600">{u.progress.advanced}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => handleReset(u)}
                    disabled={resettingId === u.id}
                    className="text-xs font-medium text-slate-500 hover:text-primary-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {resettingId === u.id ? '초기화 중...' : '비번 초기화'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  아직 가입한 회원이 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
