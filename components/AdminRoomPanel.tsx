'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type AdminAiStudent = {
  id: string
  nickname: string
  persona: {
    ageGroup: string
    job: string
    motivation: string
    aiLevel: string
    role: string
  }
  isActive: boolean
}

export type AdminRoomOverview = {
  id: string
  name: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  interest: string
  maxMembers: number
  approvedCount: number
  pendingCount: number
  aiStudents: AdminAiStudent[]
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

export type AdminAiBudget = {
  used: number
  limit: number | null
  exceeded: boolean
}

type Props = {
  rooms: AdminRoomOverview[]
  pending: AdminPendingApplication[]
  budget: AdminAiBudget
}

const levelLabel: Record<string, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
}

type RoomMessage = {
  id: string
  senderType: 'member' | 'ai_teacher' | 'ai_student'
  nickname: string
  content: string
  createdAt: string
}

export default function AdminRoomPanel({ rooms, pending, budget }: Props) {
  const router = useRouter()
  const [decidingKey, setDecidingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [viewingRoom, setViewingRoom] = useState<{ id: string; name: string } | null>(null)
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  const [managingRoomId, setManagingRoomId] = useState<string | null>(null)
  const managingRoom = rooms.find((r) => r.id === managingRoomId) ?? null
  const [togglingStudentId, setTogglingStudentId] = useState<string | null>(null)

  const toggleAiStudent = async (studentId: string, nextActive: boolean) => {
    setTogglingStudentId(studentId)
    try {
      const res = await fetch(`/api/admin/ai-students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setMessage({ type: 'error', text: data?.error ?? 'AI 학생 설정 변경에 실패했어요.' })
        return
      }
      router.refresh()
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했어요.' })
    } finally {
      setTogglingStudentId(null)
    }
  }

  const openRoomMessages = async (room: { id: string; name: string }) => {
    setViewingRoom(room)
    setMessagesLoading(true)
    setRoomMessages([])
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}/messages`)
      const data = await res.json()
      setRoomMessages(Array.isArray(data?.messages) ? data.messages : [])
    } catch {
      setRoomMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }

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
      {budget.limit !== null && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            budget.exceeded
              ? 'bg-red-50 text-red-700 border border-red-100'
              : 'bg-slate-50 text-slate-500 border border-slate-100'
          }`}
        >
          오늘 AI 토큰 사용량: {budget.used.toLocaleString()} / {budget.limit.toLocaleString()}
          {budget.exceeded && ' — 예산을 초과해서 AI쌤/AI 학생 응답이 잠시 중단돼요.'}
        </div>
      )}
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
                <th className="px-5 py-3 font-semibold">AI 학생</th>
                <th className="px-5 py-3 font-semibold">대화</th>
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
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setManagingRoomId(r.id)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {r.aiStudents.length}명 관리
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => openRoomMessages({ id: r.id, name: r.name })}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      대화 보기
                    </button>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
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
                <option value="자유주제">자유주제</option>
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

      {viewingRoom && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
          onClick={() => setViewingRoom(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{viewingRoom.name} · 최근 대화</h3>
              <button
                onClick={() => setViewingRoom(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messagesLoading && <p className="text-center text-sm text-slate-400 py-10">불러오는 중...</p>}
              {!messagesLoading && roomMessages.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-10">대화 기록이 없어요.</p>
              )}
              {!messagesLoading &&
                roomMessages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {m.senderType === 'ai_teacher' ? (
                        <span className="text-[10px] font-bold text-white bg-primary-600 rounded-full px-2 py-0.5">
                          🤖 AI쌤
                        </span>
                      ) : m.senderType === 'ai_student' ? (
                        <>
                          <span className="font-medium text-slate-600">{m.nickname}</span>
                          <span className="text-[10px] text-slate-400 border border-slate-200 rounded-full px-1.5">
                            가상 학생
                          </span>
                        </>
                      ) : (
                        <span className="font-medium text-slate-600">{m.nickname}</span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {new Date(m.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {managingRoom && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50"
          onClick={() => setManagingRoomId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{managingRoom.name} · AI 학생</h3>
              <button
                onClick={() => setManagingRoomId(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {managingRoom.aiStudents.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-10">등록된 AI 학생이 없어요.</p>
              )}
              {managingRoom.aiStudents.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.nickname}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.persona.ageGroup} · {s.persona.job} · {s.persona.motivation}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleAiStudent(s.id, !s.isActive)}
                    disabled={togglingStudentId === s.id}
                    className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-colors flex-shrink-0 disabled:opacity-50 ${
                      s.isActive
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'border border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {s.isActive ? '켜짐' : '꺼짐'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
