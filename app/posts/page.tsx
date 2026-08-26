'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { getAllPosts, formatPostDate } from '@/lib/posts'
import { CATEGORY_LABELS, CATEGORY_STYLES, type PostCategory } from '@/data/posts'

const filters: { id: PostCategory | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'trend', label: CATEGORY_LABELS.trend },
  { id: 'column', label: CATEGORY_LABELS.column },
  { id: 'interview', label: CATEGORY_LABELS.interview },
]

export default function PostsPage() {
  const [active, setActive] = useState<PostCategory | 'all'>('all')
  const posts = useMemo(() => getAllPosts(), [])
  const filtered = active === 'all' ? posts : posts.filter((p) => p.category === active)

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">포스팅</h1>
          <p className="text-slate-500 text-lg">
            AI 트렌드, 칼럼, 인터뷰까지 — 읽고 보는 재미가 있는 AI 이야기들
          </p>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-10 justify-center flex-wrap">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                active === f.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.slug}`}
              className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md hover:border-slate-200 transition-all flex flex-col"
            >
              {post.mediaType === 'image' && (
                <div
                  className={`h-36 bg-gradient-to-br ${post.accentFrom} ${post.accentTo} flex items-center justify-center relative`}
                >
                  <span className="text-6xl drop-shadow-sm">{post.emoji}</span>
                  <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/20 px-2 py-1 rounded-full">
                    이미지
                  </span>
                </div>
              )}

              {post.mediaType === 'video' && (
                <div
                  className={`h-36 bg-gradient-to-br ${post.accentFrom} ${post.accentTo} flex items-center justify-center relative`}
                >
                  <div className="w-14 h-14 rounded-full bg-white/15 border-2 border-white/40 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className="absolute bottom-3 right-3 text-[10px] font-bold text-white bg-black/40 px-2 py-1 rounded-full">
                    {post.readTime} 인터뷰
                  </span>
                  <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/20 px-2 py-1 rounded-full">
                    영상
                  </span>
                </div>
              )}

              <div className="p-7 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_STYLES[post.category]}`}>
                    {post.emoji} {CATEGORY_LABELS[post.category]}
                  </span>
                  <span className="text-xs text-slate-400">{post.readTime} 읽기</span>
                </div>
                <h2 className="font-bold text-slate-800 text-lg mb-3 group-hover:text-primary-600 transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-5 line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-slate-400">{formatPostDate(post.publishedAt)}</span>
                  <span className="text-xs font-medium text-primary-600 group-hover:underline">
                    읽기 →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-16">해당 카테고리의 글이 아직 없어요.</p>
        )}

        {/* Ask AI CTA */}
        <div className="mt-16 bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100 rounded-2xl p-8 text-center">
          <p className="text-slate-700 font-semibold text-lg mb-2">
            글을 읽다가 모르는 게 생겼나요?
          </p>
          <p className="text-slate-500 text-sm mb-5">
            엘라이 쌤에게 바로 질문하면 즉각적인 설명을 받을 수 있어요.
          </p>
          <Link
            href="/chat"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold px-7 py-3 rounded-xl transition-colors text-sm"
          >
            🤖 엘라이 쌤에게 질문하기
          </Link>
        </div>
      </div>
    </div>
  )
}
