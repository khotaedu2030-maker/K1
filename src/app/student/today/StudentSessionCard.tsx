"use client";

import { useEffect, useState } from "react";
import { beginMeetingJoin, cancelMeetingJoin, finishMeetingJoin } from "@/lib/meeting-join";
import { formatSessionDay, formatSessionTime } from "@/lib/arabic-time";
import { formatRiyadhCalendarDate, getRiyadhCalendarDate } from "@/lib/riyadh-time";

type SessionInfo = { id: string; startsAt: string; endsAt: string; title: string } | null;

function formatCountdown(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h} ساعة ${m > 0 ? `و${m} دقيقة` : ""}` : `${m} دقيقة`;
}

export default function StudentSessionCard({ session, junior }: { session: SessionInfo; junior: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!session) {
    return (
      <div className="student-card student-empty">
        <span className="icon">🌤️</span>
        <p>لا توجد جلسة قادمة حاليًا.</p>
      </div>
    );
  }

  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const opensAt = new Date(start.getTime() - 10 * 60 * 1000);
  const isTodayInRiyadh =
    formatRiyadhCalendarDate(getRiyadhCalendarDate(start)) ===
    formatRiyadhCalendarDate(getRiyadhCalendarDate(now));

  const status = now > end ? "ended" : now >= opensAt ? "joinable" : "early";

  async function join() {
    if (!session || loading) return;
    const pendingTab = beginMeetingJoin(window);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        cancelMeetingJoin(pendingTab);
        setError(typeof data.error === "string" ? data.error : "تعذّر الدخول.");
        return;
      }
      const outcome = finishMeetingJoin(window, pendingTab, data.meetingUrl);
      if (outcome === "opened") {
        setJoined(true);
      } else {
        setError(outcome === "closed"
          ? "أُغلقت نافذة الجلسة. جرّب الدخول مجددًا."
          : "رابط Microsoft Teams غير جاهز بعد. تواصل مع إدارة خُطى.");
      }
    } catch {
      cancelMeetingJoin(pendingTab);
      setError("تعذّر الاتصال. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "ended") {
    return (
      <div className="session-hero done">
        <span>{junior ? "جلسة اليوم" : session.title}</span>
        <span className="big-time">انتهى وقت الدخول إلى الجلسة</span>
      </div>
    );
  }

  return (
    <div className="session-hero">
      <span>{session.title}</span>
      {status === "early" ? (
        <span className="big-time">
          {isTodayInRiyadh ? "جلستك اليوم" : `جلستك ${formatSessionDay(start)}`} الساعة{" "}
          {formatSessionTime(start)}
        </span>
      ) : (
        <span className="big-time">{joined ? "تم تسجيل حضورك ✓" : "جاهز الآن!"}</span>
      )}
      {status === "early" && (
        <span style={{ opacity: 0.8 }}>باقي {formatCountdown(start.getTime() - now.getTime())}</span>
      )}
      {status === "joinable" && (
        <button className="btn join-pulse" onClick={join} disabled={loading}>
          {loading ? "جارٍ الدخول..." : joined ? "فتح رابط الجلسة مجددًا ←" : "دخول الجلسة الآن ←"}
        </button>
      )}
      {error && <p style={{ color: "var(--p)", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
