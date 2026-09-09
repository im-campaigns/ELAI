export type PostCategory = 'trend' | 'column' | 'interview'
export type PostMediaType = 'image' | 'video' | 'text'

export type PostChartRow = { label: string; value: string }
export type PostChart = { title: string; rows: PostChartRow[] }

export type Post = {
  id: string
  slug: string
  category: PostCategory
  title: string
  excerpt: string
  emoji: string
  mediaType: PostMediaType
  accentFrom: string
  accentTo: string
  readTime: string
  publishedAt: string
  content: string[]
  chart?: PostChart
}

export const CATEGORY_LABELS: Record<PostCategory, string> = {
  trend: 'AI 트렌드',
  column: '칼럼',
  interview: '인터뷰',
}

export const CATEGORY_STYLES: Record<PostCategory, string> = {
  trend: 'bg-primary-100 text-primary-700',
  column: 'bg-secondary-100 text-secondary-700',
  interview: 'bg-accent-100 text-accent-700',
}
