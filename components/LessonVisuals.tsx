import type { LessonChart, LessonVisual } from '@/lib/lessons'

export default function LessonVisuals({ chart, visual }: { chart: LessonChart; visual: LessonVisual }) {
  return (
    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 이미지 대체: 시각 요약 카드 */}
      <div className="bg-gradient-to-br from-primary-500 to-secondary-600 rounded-2xl p-6 text-white flex flex-col">
        <span className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">🖼️ 한눈에 보기</span>
        <p className="font-semibold leading-relaxed mb-4">{visual.caption}</p>
        <div className="mt-auto grid grid-cols-2 gap-2">
          {visual.points.map((point, i) => (
            <div key={i} className="bg-white/15 rounded-lg px-3 py-2 text-xs font-medium leading-snug">
              {point}
            </div>
          ))}
        </div>
      </div>

      {/* 도표 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">📊 {chart.title}</span>
        <div className="space-y-2.5">
          {chart.rows.map((row, i) => (
            <div key={i} className="text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0">
              <p className="font-semibold text-slate-700 mb-0.5">{row.label}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
