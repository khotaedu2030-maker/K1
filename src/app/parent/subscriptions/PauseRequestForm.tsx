"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PauseRequestForm({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/subscription-pause/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, startDate, endDate, reason }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر إرسال الطلب.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn small outline" onClick={() => setOpen(true)}>
        طلب تجميد الاشتراك
      </button>
    );
  }

  return (
    <div className="form">
      <label>
        من تاريخ
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      <label>
        إلى تاريخ (أقصى مدة 7 أيام)
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </label>
      <label>
        السبب (اختياري)
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      <div className="actions">
        <button className="btn" disabled={loading || !startDate || !endDate} onClick={submit}>
          {loading ? "جارٍ الإرسال..." : "إرسال الطلب"}
        </button>
        <button className="btn outline" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </div>
  );
}
