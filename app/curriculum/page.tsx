import Link from 'next/link'

const curriculum = [
  {
    id: 'beginner',
    emoji: '🌱',
    label: '초급',
    subtitle: 'AI 기초 다지기',
    tagClass: 'bg-secondary-100 text-secondary-700',
    borderClass: 'border-secondary-300',
    headerClass: 'bg-secondary-50',
    weeks: [
      { week: 1, title: 'AI란 무엇인가?', topics: ['인공지능의 역사', 'AI · ML · DL 차이', '실생활 속 AI 사례'] },
      { week: 2, title: 'Python 기초', topics: ['변수, 자료형, 조건문', '반복문과 함수', '리스트와 딕셔너리'] },
      { week: 3, title: '데이터 이해하기', topics: ['데이터란 무엇인가', 'NumPy · Pandas 입문', '데이터 시각화 기초 (Matplotlib)'] },
      { week: 4, title: '첫 번째 ML 모델', topics: ['선형 회귀 개념', 'scikit-learn 첫 실습', '모델 예측 결과 해석'] },
    ],
  },
  {
    id: 'intermediate',
    emoji: '🚀',
    label: '중급',
    subtitle: '머신러닝 실전',
    tagClass: 'bg-primary-100 text-primary-700',
    borderClass: 'border-primary-300',
    headerClass: 'bg-primary-50',
    weeks: [
      { week: 1, title: '지도학습 심화', topics: ['분류 vs 회귀', '결정 트리 · 랜덤 포레스트', 'SVM 이해'] },
      { week: 2, title: '비지도학습', topics: ['군집화(K-Means)', '차원 축소 (PCA)', '이상 탐지'] },
      { week: 3, title: '특성 공학', topics: ['피처 선택 · 생성', '데이터 전처리 전략', '불균형 데이터 다루기'] },
      { week: 4, title: '모델 평가와 튜닝', topics: ['교차 검증', '하이퍼파라미터 튜닝', 'GridSearchCV · Optuna'] },
    ],
  },
  {
    id: 'advanced',
    emoji: '⚡',
    label: '고급',
    subtitle: '딥러닝 & LLM 실전',
    tagClass: 'bg-accent-100 text-accent-700',
    borderClass: 'border-accent-300',
    headerClass: 'bg-accent-50',
    weeks: [
      { week: 1, title: '딥러닝 기초', topics: ['신경망 구조', '역전파 · 경사하강법', 'PyTorch 입문'] },
      { week: 2, title: 'CNN & RNN', topics: ['이미지 분류 (CNN)', '시퀀스 데이터 (RNN/LSTM)', '실습: 감성 분석'] },
      { week: 3, title: 'Transformer & LLM', topics: ['Attention 메커니즘', 'BERT · GPT 구조 이해', 'Claude API 활용'] },
      { week: 4, title: '배포 & 실전 프로젝트', topics: ['FastAPI 서빙', 'RAG 시스템 구축', 'AI 에이전트 설계'] },
    ],
  },
]

export default function CurriculumPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">커리큘럼</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            체계적인 4주 단위 커리큘럼으로 AI를 처음부터 실전까지 배웁니다.
            모르는 게 있으면 언제든 AI 강사에게 질문하세요!
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 mt-6 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <span>🤖</span>
            <span>AI 강사에게 커리큘럼 질문하기</span>
          </Link>
        </div>

        {/* Level sections */}
        <div className="space-y-16">
          {curriculum.map((level) => (
            <section key={level.id} id={level.id}>
              <div className={`flex items-center gap-3 mb-6 p-5 rounded-2xl ${level.headerClass} border ${level.borderClass}`}>
                <span className="text-4xl">{level.emoji}</span>
                <div>
                  <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-1 ${level.tagClass}`}>
                    {level.label}
                  </span>
                  <h2 className="text-2xl font-bold text-slate-800">{level.subtitle}</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {level.weeks.map((w) => (
                  <div key={w.week} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Week {w.week}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-3">{w.title}</h3>
                    <ul className="space-y-1.5">
                      {w.topics.map((topic) => (
                        <li key={topic} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-0.5 text-slate-300 flex-shrink-0">▸</span>
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center bg-gradient-to-r from-primary-600 to-primary-700 rounded-3xl p-12 text-white">
          <h2 className="text-2xl font-bold mb-3">어디서부터 시작해야 할지 모르겠나요?</h2>
          <p className="text-primary-100 mb-6">AI 강사에게 현재 수준을 말하면 맞춤 학습 경로를 추천해드립니다.</p>
          <Link
            href="/chat"
            className="inline-block bg-white text-primary-700 hover:bg-primary-50 font-bold px-8 py-3.5 rounded-xl transition-colors"
          >
            🤖 맞춤 학습 경로 추천 받기
          </Link>
        </div>
      </div>
    </div>
  )
}
