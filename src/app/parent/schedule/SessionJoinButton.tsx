"use client";

import { useEffect, useState } from "react";

type Status = "too-early" | "joinable" | "ended";

// لا عدّاد بالثواني هنا إطلاقًا (كان هذا مصدر عرض صيغ مثل "124:59:30" للجلسات البعيدة) —
// فقط تحديد الحالة الحالية (مبكر جدًا / يمكن الدخول / انتهت). النص الزمني النسبي المقروء
// ("تبدأ بعد ساعتين و15 دقيقة") مسؤولية NextSessionCard وحده، تفاديًا لتكراره هنا أيضًا.
export default function SessionJoinButton({
  sessionId,
  childId,
  startsAt,
  endsAt,
  meetingUrl,
}: {
  sessionId: string;
  childId: string;
  startsAt: string;
  endsAt: string;
  meetingUrl: string | null;
}) {
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // تحديث كل 30 ثانية يكفي لتبديل الحالة بين "مبكر/يمكن الدخول/انتهت" — لا حاجة لكل ثانية
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const opensAt = new Date(start.getTime() - 10 * 60 * 1000);

  let status: Status = "too-early";
  if (now >= opensAt && now <= end) status = "joinable";
  if (now > end) status = "ended";

  async function join() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, childId }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "تعذّر الدخول إلى الجلسة.");
      return;
    }
    if (data.meetingUrl) {
      window.open(data.meetingUrl, "_blank", "noopener,noreferrer");
    }
  }

  if (status === "ended") {
    return (
      <button className="btn outline" disabled>
        انتهت الجلسة
      </button>
    );
  }

  if (status === "too-early") {
    // النص الزمني الكبير يظهر أصلًا في NextSessionCard — هنا فقط حالة هادئة صغيرة
    return <p style={{ color: "var(--gray)", fontSize: 13, margin: 0 }}>الرابط يُفتح قبل الجلسة بعشر دقائق.</p>;
  }

  // status === "joinable" من هنا فصاعدًا
  if (!meetingUrl) {
    return (
      <p style={{ color: "var(--gray)", fontSize: 13, margin: 0 }}>
        سيظهر رابط الدخول هنا عند تجهيز الجلسة.
      </p>
    );
  }

  return (
    <>
      <button className="btn join-pulse" onClick={join} disabled={loading}>
        {loading ? "جارٍ الدخول..." : "دخول الجلسة ←"}
      </button>
      {error && <p style={{ color: "var(--p)", fontSize: 13, marginTop: 6 }}>{error}</p>}
    </>
  );
}
