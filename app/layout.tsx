import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'ELAI - Easy Learning AI | AI 교육 플랫폼',
  description: 'ELAI는 AI를 쉽고 재미있게 배울 수 있는 교육 플랫폼입니다. 초보자부터 고급자까지, 나에게 맞는 커리큘럼으로 AI를 정복하세요.',
  keywords: 'AI 교육, 인공지능 학습, ELAI, AI 입문, 머신러닝, 딥러닝',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col bg-slate-50">
        <Navigation />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
