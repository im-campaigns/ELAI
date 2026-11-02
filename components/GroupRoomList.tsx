'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export type GroupRoom = {
  id: string
  name: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  interest: string
  maxMembers: number
  approvedCount: number
  myStatus: 'pending' | 'approved' | 'rejected' | null
  isRecommended: boolean
}

const levelMeta: Record<GroupRoom['level'], { emoji: string; label: string }> = {
  beginner: { emoji: '🌱', label: '초급' },
  intermediate: { emoji: '🚀', label: '중급' },
  advanced: { emoji: '⚡', label: '고급' },
}

function RoomCard({ room, onJoin, joining }: { room: GroupRoom; onJoin: (id: string) => void; joining: boolean }) {
  const isFull = room.approvedCount >= room.maxMembers
  const { emoji, label } = levelMeta[room.level]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-slate-800">{room.name}</h3>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {room.approvedCount} / {room.maxMembers}명
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-3">{room.description}</p>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
          {emoji} {label}
        </span>
        <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{room.interest}</span>
      </div>

      {room.myStatus === 'approved' ? (
        <Link
          href={`/group/${room.id}`}
          className="block text-center bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          입장하기
        </Link>
      ) : room.myStatus === 'pending' ? (
        <div className="text-center bg-slate-50 text-slate-500 text-sm font-medium px-4 py-2.5 rounded-xl">
          승인 대기 중
        </div>
      ) : room.myStatus === 'rejected' ? (
        <div className="text-center bg-red-50 text-red-500 text-sm font-medium px-4 py-2.5 rounded-xl">
          신청이 거절되었어요
        </div>
      ) : isFull ? (
        <div className="text-center bg-slate-50 text-slate-400 text-sm font-medium px-4 py-2.5 rounded-xl">
          정원이 가득 찼어요
        </div>
      ) : (
        <>
          <button
            onClick={() => onJoin(room.id)}
            disabled={joining}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            {joining ? '신청 중...' : '참여 신청'}
          </button>
          <p className="text-xs text-slate-400 mt-2 text-center">운영자 승인 후 입장할 수 있어요</p>
        </>
      )}
    </div>
  )
}

export default function GroupRoomList({ rooms }: { rooms: GroupRoom[] }) {
  const router = useRouter()
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleJoin = async (roomId: string) => {
    setJoiningId(roomId)
    setError('')
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '참여 신청에 실패했어요.')
        return
      }
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setJoiningId(null)
    }
  }

  const recommended = rooms.filter((r) => r.isRecommended)
  const others = rooms.filter((r) => !r.isRecommended)

  return (
    <div>
      {error && (
        <div className="mb-6 bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>
      )}

      {recommended.length > 0 && (
        <div className="mb-10">
          <h2 className="font-bold text-slate-800 mb-3">✨ 회원님께 추천하는 방</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommended.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={handleJoin} joining={joiningId === room.id} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-bold text-slate-800 mb-3">전체 방 목록</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {others.map((room) => (
            <RoomCard key={room.id} room={room} onJoin={handleJoin} joining={joiningId === room.id} />
          ))}
        </div>
        {rooms.length === 0 && <p className="text-slate-400 text-sm">아직 개설된 방이 없어요.</p>}
      </div>
    </div>
  )
}
