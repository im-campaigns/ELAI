'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  initial: {
    price_main_in?: number
    price_main_out?: number
    price_cheap_in?: number
    price_cheap_out?: number
    usd_krw?: number
  }
}

const FIELDS: Array<{ key: keyof Props['initial']; label: string; hint: string }> = [
  { key: 'price_main_in', label: 'AI쌤 모델 입력', hint: '100만 토큰당 $' },
  { key: 'price_main_out', label: 'AI쌤 모델 출력', hint: '100만 토큰당 $' },
  { key: 'price_cheap_in', label: '저가 모델 입력', hint: '100만 토큰당 $ (AI 학생/요약/환영)' },
  { key: 'price_cheap_out', label: '저가 모델 출력', hint: '100만 토큰당 $' },
  { key: 'usd_krw', label: '환율', hint: '1달러 = 원 (선택)' },
]

export default function AdminPriceForm({ initial }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, initial[f.key] !== undefined ? String(initial[f.key]) : ''])),
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ type: 'error', text: data?.error ?? '저장에 실패했어요.' })
        return
      }
      setMessage({ type: 'success', text: '저장했어요.' })
      router.refresh()
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류가 발생했어요.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">{f.label}</span>
            <input
              type="number"
              step="any"
              min={0}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            <span className="block text-[11px] text-slate-400 mt-1">{f.hint}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 rounded-lg px-4 py-2 transition-colors"
        >
          {saving ? '저장 중...' : '단가 저장'}
        </button>
        {message && (
          <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  )
}
