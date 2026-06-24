import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-slate-800 text-slate-300 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white text-xl font-bold mb-3">ELAI</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Easy Learning AI — 누구나 쉽게 AI를 배울 수 있는 교육 플랫폼입니다.
              초보자부터 고급자까지, 나에게 맞는 커리큘럼으로 시작하세요.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">메뉴</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">홈</Link></li>
              <li><Link href="/curriculum" className="hover:text-white transition-colors">커리큘럼</Link></li>
              <li><Link href="/chat" className="hover:text-white transition-colors">AI 채팅 강사</Link></li>
              <li><Link href="/posts" className="hover:text-white transition-colors">포스팅</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">레벨별 학습</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/curriculum#beginner" className="hover:text-white transition-colors">🌱 초급 — AI 기초</Link></li>
              <li><Link href="/curriculum#intermediate" className="hover:text-white transition-colors">🚀 중급 — 머신러닝</Link></li>
              <li><Link href="/curriculum#advanced" className="hover:text-white transition-colors">⚡ 고급 — 딥러닝 & 실전</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
          <p>© 2025 ELAI. Made with ❤️ for AI learners everywhere.</p>
          <p>Powered by <span className="text-primary-400">Claude AI</span></p>
        </div>
      </div>
    </footer>
  )
}
