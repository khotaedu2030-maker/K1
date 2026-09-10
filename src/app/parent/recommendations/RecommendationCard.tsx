"use client";

import { useState } from "react";

export default function RecommendationCard({
  id,
  subject,
  reason,
  status,
}: {
  id: string;
  subject: string | null;
  reason: string;
  status: string;
}) {
  const [localStatus, setLocalStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestSession() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/recommendations/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendationId: id }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "تعذّر إرسال الطلب.");
      return;
    }
    setLocalStatus("actioned");
  }

  return (
    <div className="dashcard" style={{ marginBottom: 16 }}>
      <span className="badge">{subject ?? "توصية عامة"}</span>
      <p style={{ marginTop: 10 }}>{reason}</p>
      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      {localStatus === "open" ? (
        <button className="btn" disabled={loading} onClick={requestSession}>
          {loading ? "جارٍ الإرسال..." : "طلب جلسة تقوية فردية مركّزة ←"}
        </button>
      ) : (
        <p style={{ color: "var(--t)", fontWeight: 800 }}>تم إرسال طلبك، سيتواصل معك فريق خُطى قريبًا.</p>
      )}
    </div>
  );
}
