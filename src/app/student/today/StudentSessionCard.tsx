"use client";

import { useEffect, useState } from "react";

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
        <p>لا توجد جلسة اليوم — يوم راحة!</p>
      </div>
    );
  }

  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const opensAt = new Date(start.getTime() - 10 * 60 * 1000);

  const status = now > end ? "ended" : now >= opensAt ? "joinable" : "early";

  async function join() {
    if (!session) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/student/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر الدخول.");
      return;
    }
    setJoined(true);
    if (data.meetingUrl) window.open(data.meetingUrl, "_blank", "noopener,noreferrer");
  }

  if (status === "ended" || joined) {
    return (
      <div className="session-hero done">
        <span>{junior ? "🎉" : "جلسة اليوم"}</span>
        <span className="big-time">تمت الجلسة ✓</span>
      </div>
    );
  }

  return (
    <div className="session-hero">
      <span>{session.title}</span>
      {status === "early" ? (
        <span className="big-time">
          {junior ? "جلستك اليوم" : "جلستك"} الساعة{" "}
          {start.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : (
        <span className="big-time">جاهز الآن!</span>
      )}
      {status === "early" && (
        <span style={{ opacity: 0.8 }}>باقي {formatCountdown(start.getTime() - now.getTime())}</span>
      )}
      {status === "joinable" && (
        <button className="btn join-pulse" onClick={join} disabled={loading}>
          {loading ? "جارٍ الدخول..." : "دخول الجلسة الآن ←"}
        </button>
      )}
      {error && <p style={{ color: "var(--p)", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
