"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  reviewing: "قيد المراجعة",
  shortlisted: "على القائمة المختصرة",
  rejected: "مرفوض",
  accepted: "مقبول",
};

export default function StatusSelect({ applicationId, currentStatus }: { applicationId: string; currentStatus: string }) {
  const router = useRouter();
  const [statusValue, setStatusValue] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(status: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/teacher-applications/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "تعذّر تحديث الطلب");
        return;
      }
      setStatusValue(status);
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم. لم تتغير حالة الطلب.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <select value={statusValue} disabled={loading} onChange={(e: ChangeEvent<HTMLSelectElement>) => { void update(e.target.value); }} aria-label="حالة طلب المعلم">
        {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {error && <p role="alert" style={{ color: "var(--p)", maxWidth: 280, fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
