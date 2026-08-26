import { posts as postsData, type Post, type PostCategory } from '@/data/posts'

export type { Post, PostCategory } from '@/data/posts'

function sortPosts(items: Post[]): Post[] {
  return [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  )
}

export function getAllPosts(): Post[] {
  return sortPosts(postsData)
}

export function getPostsByCategory(category: PostCategory | 'all'): Post[] {
  const all = getAllPosts()
  if (category === 'all') return all
  return all.filter((p) => p.category === category)
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

export function getPostBySlug(slug: string): Post | undefined {
  const decoded = decodeSlug(slug)
  return postsData.find((p) => p.slug === decoded)
}

export function getAdjacentPosts(slug: string): { prev: Post | null; next: Post | null } {
  const decoded = decodeSlug(slug)
  const all = getAllPosts()
  const idx = all.findIndex((p) => p.slug === decoded)
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null,
  }
}

export function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
