import Link from 'next/link'

type Post = {
  id: number
  title: string
  excerpt: string
  date: string
  category: string
  categoryColor: string
  emoji: string
  readTime: string
}

const posts: Post[] = [
  {
    id: 1,
    title: 'AI가 뭔지 5분 만에 이해하기',
    excerpt: '인공지능, 머신러닝, 딥러닝… 다 비슷하게 들리지만 사실 다 다릅니다. 커피 한 잔 마시며 핵심만 쏙 뽑아드립니다.',
    date: '2025년 5월 10일',
    category: '초급',
    categoryColor: 'bg-secondary-100 text-secondary-700',
    emoji: '🌱',
    readTime: '5분',
  },
  {
    id: 2,
    title: 'ChatGPT, Gemini, Claude — 세 AI의 차이점',
    excerpt: '요즘 뜨는 AI들, 뭐가 어떻게 다른 걸까요? 실제 사용 사례와 함께 각 AI의 특징을 비교해봤습니다.',
    date: '2025년 5월 7일',
    category: '초급',
    categoryColor: 'bg-secondary-100 text-secondary-700',
    emoji: '🤔',
    readTime: '7분',
  },
  {
    id: 3,
    title: 'Python으로 첫 머신러닝 모델 만들기',
    excerpt: 'scikit-learn을 사용해서 30줄 미만의 코드로 아이리스 꽃 분류 모델을 만들어봅시다. 정말 쉽습니다!',
    date: '2025년 5월 4일',
    category: '중급',
    categoryColor: 'bg-primary-100 text-primary-700',
    emoji: '🐍',
    readTime: '10분',
  },
  {
    id: 4,
    title: 'Transformer 아키텍처 완전 정복',
    excerpt: '"Attention is All You Need" 논문을 기반으로 Transformer의 핵심 구조를 그림과 함께 쉽게 설명합니다.',
    date: '2025년 5월 1일',
    category: '고급',
    categoryColor: 'bg-accent-100 text-accent-700',
    emoji: '⚡',
    readTime: '15분',
  },
  {
    id: 5,
    title: '데이터 전처리, 왜 이렇게 중요한가?',
    excerpt: '"Garbage in, Garbage out" — ML 프로젝트의 80%는 데이터 정제에 있다고 합니다. 실전 팁을 공유합니다.',
    date: '2025년 4월 28일',
    category: '중급',
    categoryColor: 'bg-primary-100 text-primary-700',
    emoji: '🧹',
    readTime: '8분',
  },
  {
    id: 6,
    title: 'RAG(검색 증강 생성)으로 나만의 AI 만들기',
    excerpt: '내 문서를 기반으로 대답하는 AI 챗봇, 생각보다 어렵지 않습니다. LangChain과 Claude API로 구현해봐요.',
    date: '2025년 4월 24일',
    category: '고급',
    categoryColor: 'bg-accent-100 text-accent-700',
    emoji: '🔍',
    readTime: '12분',
  },
]

const categories = ['전체', '초급', '중급', '고급']

export default function PostsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">포스팅</h1>
          <p className="text-slate-500 text-lg">
            AI 학습에 도움이 되는 글들을 모았습니다. 초급부터 고급까지!
          </p>
        </div>

        {/* Category filter — static display (UI only) */}
        <div className="flex gap-2 mb-10 justify-center flex-wrap">
          {categories.map((cat, i) => (
            <span
              key={cat}
              className={`px-5 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                i === 0
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Posts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-2xl border border-slate-100 p-7 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${post.categoryColor}`}>
                  {post.emoji} {post.category}
                </span>
                <span className="text-xs text-slate-400">{post.readTime} 읽기</span>
              </div>
              <h2 className="font-bold text-slate-800 text-lg mb-3 group-hover:text-primary-600 transition-colors leading-snug">
                {post.title}
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-5 line-clamp-2">
                {post.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{post.date}</span>
                <span className="text-xs font-medium text-primary-600 group-hover:underline">
                  읽기 →
                </span>
              </div>
            </article>
          ))}
        </div>

        {/* Ask AI CTA */}
        <div className="mt-16 bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100 rounded-2xl p-8 text-center">
          <p className="text-slate-700 font-semibold text-lg mb-2">
            글을 읽다가 모르는 게 생겼나요?
          </p>
          <p className="text-slate-500 text-sm mb-5">
            AI 강사에게 바로 질문하면 즉각적인 설명을 받을 수 있어요.
          </p>
          <Link
            href="/chat"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-semibold px-7 py-3 rounded-xl transition-colors text-sm"
          >
            🤖 AI 강사에게 질문하기
          </Link>
        </div>
      </div>
    </div>
  )
}
