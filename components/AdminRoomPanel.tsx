'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type AdminRoomOverview = {
  id: string
  name: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  interest: string
  maxMembers: number
  approvedCount: number
  pendingCount: number
}

export type AdminPendingApplication = {
  roomId: string
  userId: string
  roomName: string
  nickname: string
  job: string | null
  level: string | null
  interest: string | null
  requestedAt: string
}

type Props = {
  rooms: AdminRoomOverview[]
  pending: AdminPendingApplication[]
}

const levelLabel: Record<string, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
}

export default function AdminRoomPanel({ rooms, pending }: Props) {
  const router = useRouter()
  const [decidingKey, setDecidingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    level: 'beginner',
    interest: '업무활용',
    maxMembers: 6,
  })
  const [creating, setCreating] = useState(false)

  const decide = async (roomId: string, userId: string, decision: 'approved' | 'rejected') => {
    const key = `${roomId}:${userId}`
    setDecidingKey(key)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/rooms/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, decision }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error ?? '처리에 실패했어요.' })
        return
      }
      router.refresh()
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했어요.' })
    } finally {
      setDecidingKey(null)
    }
  }

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error ?? '방 생성에 실패했어요.' })
        return
      }
      setMessage({ type: 'success', text: '방을 만들었어요.' })
      setForm({ name: '', description: '', level: 'beginner', interest: '업무활용', maxMembers: 6 })
      router.refresh()
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했어요.' })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <h2 className="font-bold text-slate-800 mb-3">승인 대기 신청 ({pending.length})</h2>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">닉네임</th>
                <th className="px-5 py-3 font-semibold">직업</th>
                <th className="px-5 py-3 font-semibold">수준</th>
                <th className="px-5 py-3 font-semibold">관심분야</th>
                <th className="px-5 py-3 font-semibold">신청한 방</th>
                <th className="px-5 py-3 font-semibold">신청 시각</th>
                <th className="px-5 py-3 font-semibold">처리</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => {
                const key = `${p.roomId}:${p.userId}`
                const isDeciding = decidingKey === key
                return (
                  <tr key={key} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-700">{p.nickname}</td>
                    <td className="px-5 py-3 text-slate-500">{p.job ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{p.level ? levelLabel[p.level] : '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{p.interest ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{p.roomName}</td>
                    <td className="px-5 py-3 text-slate-500">{new Date(p.requestedAt).toLocaleString('ko-KR')}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => decide(p.roomId, p.userId, 'approved')}
                          disabled={isDeciding}
                          className="text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => decide(p.roomId, p.userId, 'rejected')}
                          disabled={isDeciding}
                          className="text-xs font-medium text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                        >
                          거절
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    승인 대기 중인 신청이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-bold text-slate-800 mb-3">방별 현황</h2>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">방 이름</th>
                <th className="px-5 py-3 font-semibold">수준 / 관심분야</th>
                <th className="px-5 py-3 font-semibold">승인 인원 / 정원</th>
                <th className="px-5 py-3 font-semibold">대기 인원</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-700">{r.name}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {levelLabel[r.level]} · {r.interest}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {r.approvedCount} / {r.maxMembers}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{r.pendingCount}</td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    아직 개설된 방이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-bold text-slate-800 mb-3">새 방 만들기</h2>
        <form onSubmit={createRoom} className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">방 이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">설명</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">수준</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
              >
                <option value="beginner">초급</option>
                <option value="intermediate">중급</option>
                <option value="advanced">고급</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">관심분야</label>
              <select
                value={form.interest}
                onChange={(e) => setForm({ ...form, interest: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
              >
                <option value="업무활용">업무활용</option>
                <option value="공부">공부</option>
                <option value="창작">창작</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">정원</label>
              <input
                type="number"
                min={1}
                value={form.maxMembers}
                onChange={(e) => setForm({ ...form, maxMembers: Number(e.target.value) })}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            {creating ? '만드는 중...' : '방 만들기'}
          </button>
        </form>
      </div>
    </div>
  )
}
