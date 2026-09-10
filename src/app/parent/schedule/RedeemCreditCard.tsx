"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EligibleSession = { id: string; startsAt: string; title: string };

export default function RedeemCreditCard({
  creditId,
  childName,
  expiresAt,
  eligibleSessions,
}: {
  creditId: string;
  childName: string;
  expiresAt: string | null;
  eligibleSessions: EligibleSession[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function redeem(sessionId: string) {
    setLoading(sessionId);
    setError(null);
    const res = await fetch("/api/makeup/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditId, sessionId }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "تعذّر الحجز.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="dashcard" style={{ background: "var(--teal-light)" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>تم حجز الجلسة التعويضية ✓</p>
      </div>
    );
  }

  return (
    <div className="dashcard">
      <span className="badge">رصيد تعويض متاح — {childName}</span>
      {expiresAt && (
        <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 6 }}>
          ينتهي في {new Date(expiresAt).toLocaleDateString("ar-SA")}
        </p>
      )}
      {eligibleSessions.length === 0 ? (
        <p style={{ color: "var(--gray)", marginTop: 10 }}>لا توجد جلسات تعويضية متاحة حاليًا — تحقق لاحقًا.</p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {eligibleSessions.map((s) => (
            <div className="taskline" key={s.id}>
              <span>
                {s.title} • {new Date(s.startsAt).toLocaleString("ar-SA", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
              </span>
              <button className="btn small" disabled={loading === s.id} onClick={() => redeem(s.id)}>
                {loading === s.id ? "..." : "استخدم الرصيد هنا"}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p style={{ color: "var(--p)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
