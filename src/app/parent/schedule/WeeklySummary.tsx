type WeeklyStats = { totalSessions: number; attended: number; upcoming: number } | null;

export default function WeeklySummary({ stats }: { stats: WeeklyStats }) {
  if (!stats || stats.totalSessions === 0) {
    return (
      <div className="dashcard">
        <b>هذا الأسبوع</b>
        <p style={{ color: "var(--gray)", marginTop: 8 }}>لا توجد جلسات هذا الأسبوع بعد.</p>
      </div>
    );
  }

  return (
    <div className="dashcard">
      <b>هذا الأسبوع</b>
      <div className="kpi kpi-3" style={{ marginTop: 14 }}>
        <div>
          <strong>{stats.totalSessions}</strong>
          <span>الجلسات</span>
        </div>
        <div>
          <strong>{stats.attended}</strong>
          <span>تم حضورها</span>
        </div>
        <div>
          <strong>{stats.upcoming}</strong>
          <span>القادمة</span>
        </div>
      </div>
    </div>
  );
}
