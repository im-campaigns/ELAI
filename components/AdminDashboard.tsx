import type { AdminStats } from '@/lib/adminStats'
import AdminPriceForm from '@/components/AdminPriceForm'

const levelLabel: Record<string, string> = { beginner: '초급', intermediate: '중급', advanced: '고급' }
const purposeLabel: Record<string, string> = {
  ai_teacher_reply: 'AI쌤 답변',
  welcome: '환영 인사',
  clarification: '보정 설명',
  ai_student_reply: 'AI 학생 답변',
  summary: '대화 요약',
}

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR')
const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(0)}%`)
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR') : '—')

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      {desc && <p className="text-sm text-slate-500 mt-1 mb-4">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </section>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-slate-400 text-xs uppercase tracking-wider">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-slate-400">
        {text}
      </td>
    </tr>
  )
}

export default function AdminDashboard({ stats }: { stats: AdminStats }) {
  const { usage, budget, members, safety } = stats
  const krw = stats.priceSettings.usd_krw
  const costText = (usd: number | null) => {
    if (usd === null) return '단가 입력 필요'
    const base = `$${usd.toFixed(usd < 1 ? 3 : 2)}`
    return krw ? `${base} (약 ${fmt(usd * krw)}원)` : base
  }
  const barColor = budget.level === 'exceeded' ? 'bg-red-500' : budget.level === 'warn' ? 'bg-amber-500' : 'bg-primary-600'

  return (
    <div>
      {stats.notes.length > 0 && (
        <div className="rounded-xl px-4 py-3 text-sm bg-amber-50 text-amber-800 border border-amber-100 space-y-1">
          {stats.notes.map((n) => (
            <p key={n}>• {n}</p>
          ))}
        </div>
      )}

      {/* A. 비용·사용량 */}
      <Section
        title="비용 · 사용량"
        desc="'오늘'은 한국시간 오전 9시부터예요(AI 하루 예산을 세는 기준과 같아요). 예상 비용은 아래에 입력한 단가 기준의 추정치예요."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['today', 'd7', 'd30'] as const).map((w) => (
            <Card
              key={w}
              title={w === 'today' ? '오늘 토큰' : w === 'd7' ? '최근 7일 토큰' : '최근 30일 토큰'}
              value={fmt(usage[w].total)}
              sub={`AI쌤 ${fmt(usage[w].teacher)} · AI 학생 ${fmt(usage[w].student)} · 요약 ${fmt(usage[w].summary)} / 예상 ${costText(usage[w].estimatedCostUsd)}`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">오늘 예산 사용률</span>
            <span className="text-slate-500">
              {budget.limit === null
                ? '예산 미설정 (AI_DAILY_TOKEN_BUDGET)'
                : `${fmt(budget.used)} / ${fmt(budget.limit)} (${pct(budget.percent)})`}
            </span>
          </div>
          {budget.limit !== null && (
            <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, budget.percent ?? 0)}%` }} />
            </div>
          )}
          {budget.level === 'warn' && (
            <p className="text-sm text-amber-700 mt-2">예산의 80%를 넘었어요. 곧 AI 응답이 멈출 수 있어요.</p>
          )}
          {budget.level === 'exceeded' && (
            <p className="text-sm text-red-600 mt-2">예산을 넘어서 AI쌤/AI 학생 응답이 잠시 중단돼요.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 mt-3">
          <p className="text-sm font-medium text-slate-700 mb-1">모델 단가 입력 (예상 비용 계산용)</p>
          <p className="text-xs text-slate-400 mb-3">
            Anthropic 요금표를 보고 직접 입력해 주세요. 입력한 값은 추정에만 쓰이고, 실제 청구액은 Anthropic 콘솔에서
            확인하세요.
          </p>
          <AdminPriceForm initial={stats.priceSettings} />
        </div>

        <h3 className="font-semibold text-slate-700 mt-6 mb-2">날짜별 토큰 (최근 14일)</h3>
        <Table head={['날짜', '합계', 'AI쌤', 'AI 학생', '요약']}>
          {stats.byDay.map((d) => (
            <tr key={d.date} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 text-slate-600">{d.date}</td>
              <td className="px-4 py-2.5 font-medium text-slate-700">{fmt(d.total)}</td>
              <td className="px-4 py-2.5 text-slate-500">{fmt(d.teacher)}</td>
              <td className="px-4 py-2.5 text-slate-500">{fmt(d.student)}</td>
              <td className="px-4 py-2.5 text-slate-500">{fmt(d.summary)}</td>
            </tr>
          ))}
        </Table>

        <h3 className="font-semibold text-slate-700 mt-6 mb-2">방별 토큰</h3>
        <Table head={['방', '오늘', '7일', '30일']}>
          {stats.rooms.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 font-medium text-slate-700">{r.name}</td>
              <td className="px-4 py-2.5 text-slate-600">{fmt(r.tokensToday)}</td>
              <td className="px-4 py-2.5 text-slate-600">{fmt(r.tokens7d)}</td>
              <td className="px-4 py-2.5 text-slate-600">{fmt(r.tokens30d)}</td>
            </tr>
          ))}
          {stats.rooms.length === 0 && <Empty cols={4} text="아직 방이 없어요." />}
        </Table>
      </Section>

      {/* B. 방 운영 */}
      <Section title="방 운영 현황" desc={`방마다 AI 메시지는 하루 ${stats.roomCapPerDay}개까지예요. 넘으면 그날은 AI가 쉬어요.`}>
        <Table head={['방', '회원 / 정원', '승인 대기', 'AI 학생(켜짐)', '마지막 대화', '오늘 메시지', '오늘 AI 메시지', '상태']}>
          {stats.rooms.map((r) => {
            const muted = r.capReached || budget.level === 'exceeded'
            return (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-700">
                  {r.name}
                  <span className="block text-xs text-slate-400 font-normal">
                    {levelLabel[r.level] ?? r.level} · {r.interest}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {r.approved} / {r.maxMembers}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{r.pending}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.activeAiStudents}명</td>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{when(r.lastActivityAt)}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.todayMessages}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {r.todayAiMessages} / {stats.roomCapPerDay}
                </td>
                <td className="px-4 py-2.5">
                  {muted ? (
                    <span className="text-xs font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                      {r.capReached ? '상한 도달' : '예산 초과'}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">정상</span>
                  )}
                </td>
              </tr>
            )
          })}
          {stats.rooms.length === 0 && <Empty cols={8} text="아직 개설된 방이 없어요." />}
        </Table>
      </Section>

      {/* C. 회원 학습 요약 */}
      <Section title="회원 학습 요약">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card title="전체 회원" value={`${members.total}명`} />
          <Card
            title="온보딩 완료율"
            value={pct(members.onboardingRate)}
            sub={`${members.onboardingDone} / ${members.total}명`}
          />
          <Card title="평균 커리큘럼 진도" value={pct(members.avgProgressPercent)} sub="전체 회원 기준" />
          <Card
            title="최근 접속"
            value={members.activeLast7d === null ? '—' : `7일 ${members.activeLast7d}명`}
            sub={members.activeLast30d === null ? 'SQL 3-9 실행 후 집계' : `30일 ${members.activeLast30d}명`}
          />
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-700">수준 분포 </span>
          초급 {members.byLevel.beginner}명 · 중급 {members.byLevel.intermediate}명 · 고급 {members.byLevel.advanced}명 ·
          미설정 {members.byLevel.unset}명
        </div>
      </Section>

      {/* D. 안전 모니터링 */}
      <Section
        title="안전 모니터링"
        desc="AI 답변에 전화번호·링크·SNS 유도 등이 섞여 안전 필터가 막은 횟수예요. 차단된 문장 원문은 저장하지 않아요."
      >
        <div className="grid grid-cols-3 gap-3">
          <Card title="오늘" value={`${safety.today}건`} />
          <Card title="7일" value={`${safety.d7}건`} />
          <Card title="30일" value={`${safety.d30}건`} />
        </div>
        <h3 className="font-semibold text-slate-700 mt-6 mb-2">최근 차단 기록</h3>
        <Table head={['시각', '방', '종류', '어디서']}>
          {safety.recent.map((e, i) => (
            <tr key={`${e.createdAt}-${i}`} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{when(e.createdAt)}</td>
              <td className="px-4 py-2.5 text-slate-700">{e.roomName}</td>
              <td className="px-4 py-2.5 text-slate-600">{e.reason}</td>
              <td className="px-4 py-2.5 text-slate-500">{purposeLabel[e.purpose] ?? e.purpose}</td>
            </tr>
          ))}
          {safety.recent.length === 0 && (
            <Empty cols={4} text={safety.available ? '최근 30일 동안 차단된 적이 없어요.' : '아직 기록이 없어요.'} />
          )}
        </Table>
        {safety.byRoom.length > 0 && (
          <p className="text-sm text-slate-500 mt-3">
            방별(30일): {safety.byRoom.map((r) => `${r.roomName} ${r.count}건`).join(' · ')}
          </p>
        )}
      </Section>
    </div>
  )
}
