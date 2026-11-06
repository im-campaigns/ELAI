export default function GroupAiNotice() {
  return (
    <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs text-slate-500">
      <span aria-hidden>ℹ️</span>
      <div className="space-y-1">
        <p>학습 분위기를 돕기 위해 AI 참여자가 함께할 수 있어요.</p>
        <p>방 안에서는 전화번호, 주소, 실명 등 개인정보를 묻거나 공유하지 말아 주세요.</p>
      </div>
    </div>
  )
}
