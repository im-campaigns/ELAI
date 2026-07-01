'use client'

import { useState } from 'react'
import type { Quiz } from '@/lib/lessons'

export default function QuizCard({ quiz }: { quiz: Quiz }) {
  const [selected, setSelected] = useState<number | null>(null)

  const isAnswered = selected !== null
  const isCorrect = selected === quiz.correctIndex

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-primary-50 border-b border-primary-100 px-7 py-4 flex items-center gap-2">
        <span className="text-lg">✏️</span>
        <span className="font-bold text-primary-700 text-sm">퀴즈</span>
      </div>

      <div className="p-7">
        <p className="font-semibold text-slate-800 text-lg mb-6 leading-snug">
          {quiz.question}
        </p>

        <div className="space-y-3">
          {quiz.options.map((option, i) => {
            let optionClass =
              'w-full text-left px-5 py-4 rounded-xl border-2 text-sm transition-all cursor-pointer leading-relaxed '

            if (!isAnswered) {
              optionClass += 'border-slate-200 text-slate-700 hover:border-primary-300 hover:bg-primary-50'
            } else if (i === quiz.correctIndex) {
              optionClass += 'border-secondary-400 bg-secondary-50 text-secondary-800 font-semibold'
            } else if (i === selected) {
              optionClass += 'border-red-300 bg-red-50 text-red-700'
            } else {
              optionClass += 'border-slate-100 text-slate-400 cursor-default'
            }

            return (
              <button
                key={i}
                className={optionClass}
                onClick={() => !isAnswered && setSelected(i)}
                disabled={isAnswered}
              >
                <span className="font-bold mr-3 text-slate-400">
                  {String.fromCharCode(65 + i)}.
                </span>
                {option}
                {isAnswered && i === quiz.correctIndex && (
                  <span className="ml-2">✅</span>
                )}
                {isAnswered && i === selected && i !== quiz.correctIndex && (
                  <span className="ml-2">❌</span>
                )}
              </button>
            )
          })}
        </div>

        {isAnswered && (
          <div
            className={`mt-6 p-5 rounded-xl text-sm leading-relaxed ${
              isCorrect
                ? 'bg-secondary-50 border border-secondary-200 text-secondary-800'
                : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}
          >
            <p className="font-bold mb-1">{isCorrect ? '🎉 정답이에요!' : '🤔 아쉽지만 다시 한번!'}</p>
            <p>{quiz.explanation}</p>
          </div>
        )}

        {isAnswered && (
          <button
            className="mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors underline"
            onClick={() => setSelected(null)}
          >
            다시 풀기
          </button>
        )}
      </div>
    </div>
  )
}
