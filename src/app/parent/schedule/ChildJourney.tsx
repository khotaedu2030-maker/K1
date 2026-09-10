const readinessNote: Record<string, string> = {
  ready: "جاهز تمامًا لليوم التالي.",
  needs_light_review: "يحتاج مراجعة خفيفة لليوم التالي.",
  needs_attention: "يحتاج انتباهًا أكبر في الجلسة القادمة.",
};

export type PulseSnapshot = {
  tasksCompletedCount: number;
  readinessStatus: string | null;
  remainingReview: string | null;
  updatedAt: string;
} | null;

export default function ChildJourney({ pulse }: { pulse: PulseSnapshot }) {
  if (!pulse) {
    return (
      <div className="dashcard">
        <b>تقدّم الطالب</b>
        <p style={{ color: "var(--gray)", marginTop: 8 }}>ستظهر هنا تحديثات تقدّم طفلك بعد أول جلسة.</p>
        <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 4 }}>نلخص لك ما أنجزه وما يحتاج متابعة منك.</p>
      </div>
    );
  }

  const lastUpdateText =
    pulse.tasksCompletedCount > 0
      ? `أنجز ${pulse.tasksCompletedCount} من مهامه في آخر جلسة.`
      : pulse.readinessStatus
        ? readinessNote[pulse.readinessStatus] ?? "تم توثيق آخر جلسة."
        : "تم توثيق آخر جلسة.";

  const nextText = pulse.remainingReview || (pulse.readinessStatus ? readinessNote[pulse.readinessStatus] : null) || "الاستعداد للجلسة القادمة.";

  return (
    <div className="dashcard">
      <b>تقدّم الطالب</b>
      <div className="taskline">
        <span className="ok">✓</span>
        <div>
          <b style={{ fontSize: 13 }}>آخر تحديث</b>
          <p style={{ margin: "2px 0 0", color: "var(--gray)" }}>{lastUpdateText}</p>
        </div>
      </div>
      <div className="taskline">
        <span style={{ color: "var(--t)" }}>←</span>
        <div>
          <b style={{ fontSize: 13 }}>القادم</b>
          <p style={{ margin: "2px 0 0", color: "var(--gray)" }}>{nextText}</p>
        </div>
      </div>
    </div>
  );
}
