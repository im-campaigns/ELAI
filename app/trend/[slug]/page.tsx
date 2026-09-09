import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostBySlug, getAdjacentPosts, getAllPosts, formatPostDate } from '@/lib/posts'
import { CATEGORY_LABELS, CATEGORY_STYLES } from '@/data/posts'

type Props = { params: { slug: string } }

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props) {
  const post = getPostBySlug(params.slug)
  if (!post) return {}
  return {
    title: `${post.title} | ELAI 트렌드`,
    description: post.excerpt,
  }
}

export default function TrendPostPage({ params }: Props) {
  const post = getPostBySlug(params.slug)
  if (!post) notFound()

  const { prev, next } = getAdjacentPosts(params.slug)
  const isQA = post.content.some((line) => line.startsWith('Q.'))

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
          <Link href="/trend" className="hover:text-slate-600 transition-colors">
            트렌드
          </Link>
          <span>/</span>
          <span className="text-slate-600">{CATEGORY_LABELS[post.category]}</span>
        </div>

        {/* Media banner */}
        {post.mediaType === 'image' && (
          <div
            className={`h-48 rounded-2xl bg-gradient-to-br ${post.accentFrom} ${post.accentTo} flex items-center justify-center mb-6`}
          >
            <span className="text-7xl drop-shadow-sm">{post.emoji}</span>
          </div>
        )}
        {post.mediaType === 'video' && (
          <div
            className={`h-48 rounded-2xl bg-gradient-to-br ${post.accentFrom} ${post.accentTo} flex items-center justify-center mb-6 relative`}
          >
            <div className="w-16 h-16 rounded-full bg-white/15 border-2 border-white/40 flex items-center justify-center">
              <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="absolute bottom-4 right-4 text-xs font-bold text-white bg-black/40 px-2.5 py-1 rounded-full">
              {post.readTime} 인터뷰
            </span>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-100 p-8 mb-6">
          <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
            <span className={`font-bold px-2.5 py-1 rounded-full ${CATEGORY_STYLES[post.category]}`}>
              {post.emoji} {CATEGORY_LABELS[post.category]}
            </span>
            <span>⏱ {post.readTime} 읽기</span>
            <span>{formatPostDate(post.publishedAt)}</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 leading-tight mb-3">{post.title}</h1>
          <p className="text-slate-500 leading-relaxed">{post.excerpt}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-100 p-8 mb-6">
          <div className="prose prose-slate max-w-none space-y-4">
            {post.content.map((paragraph, i) =>
              isQA && paragraph.startsWith('Q.') ? (
                <p key={i} className="font-bold text-slate-800 text-base mb-1 mt-6 first:mt-0">
                  {paragraph}
                </p>
              ) : (
                <p key={i} className="text-slate-700 leading-relaxed text-base">
                  {paragraph}
                </p>
              ),
            )}
          </div>
        </div>

        {/* Chart (도표) */}
        {post.chart && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 block">
              📊 {post.chart.title}
            </span>
            <div className="space-y-3">
              {post.chart.rows.map((row, i) => (
                <div key={i} className="text-sm border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                  <p className="font-semibold text-slate-700 mb-0.5">{row.label}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ask AI */}
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100 rounded-2xl p-6 mb-8 flex items-center gap-4">
          <span className="text-3xl">🤖</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-700 mb-0.5">더 궁금한 점이 있나요?</p>
            <p className="text-slate-500 text-sm">AI쌤에게 바로 질문해보세요.</p>
          </div>
          <Link
            href="/chat"
            className="flex-shrink-0 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            질문하기
          </Link>
        </div>

        {/* Prev / Next navigation */}
        <div className="grid grid-cols-2 gap-4">
          {prev ? (
            <Link
              href={`/trend/${prev.slug}`}
              className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-sm transition-all group"
            >
              <p className="text-xs text-slate-400 mb-1">← 이전 글</p>
              <p className="font-semibold text-slate-700 text-sm group-hover:text-primary-600 transition-colors line-clamp-2">
                {prev.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/trend/${next.slug}`}
              className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-sm transition-all group text-right"
            >
              <p className="text-xs text-slate-400 mb-1">다음 글 →</p>
              <p className="font-semibold text-slate-700 text-sm group-hover:text-primary-600 transition-colors line-clamp-2">
                {next.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href="/trend" className="text-sm text-slate-400 hover:text-slate-600 transition-colors underline">
            전체 트렌드로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
