"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  { value: "present", label: "حاضر" },
  { value: "absent", label: "غائب" },
  { value: "late", label: "متأخر" },
  { value: "excused", label: "معذور" },
];

export default function AttendanceOverrideButton({ sessionId, childId, currentStatus }: { sessionId: string; childId: string; currentStatus: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 2) return setError("سبب التصحيح مطلوب");
    if (trimmedReason.length > 500) return setError("سبب التصحيح طويل جدًا");
    if (newStatus === currentStatus) return setError("اختر حالة مختلفة عن الحالة الحالية");
    if (!window.confirm("سيتم تعديل سجل الحضور عبر الإجراء الإداري الموثق. هل تريد المتابعة؟")) return;

    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/attendance/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, childId, newStatus, overrideReason: trimmedReason }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setError(data.error ?? "تعذّر التصحيح");

    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (!open) return <button className="btn small outline" onClick={() => setOpen(true)}>تصحيح</button>;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select value={newStatus} onChange={(event: ChangeEvent<HTMLSelectElement>) => setNewStatus(event.target.value)}>
        {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
      </select>
      <input dir="rtl" placeholder="سبب التصحيح (مطلوب)" value={reason} onChange={(event) => setReason(event.target.value)} style={{ width: 160 }} />
      <button className="btn small" disabled={loading} onClick={submit}>{loading ? "..." : "تأكيد"}</button>
      <button className="btn small outline" onClick={() => setOpen(false)}>×</button>
      {error && <span style={{ color: "var(--p)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
