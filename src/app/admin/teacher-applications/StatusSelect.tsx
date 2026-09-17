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
  const [loading, setLoading] = useState(false);

  async function update(status: string) {
    setLoading(true);
    await fetch("/api/teacher-applications/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, status }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select value={currentStatus} disabled={loading} onChange={(e: ChangeEvent<HTMLSelectElement>) => update(e.target.value)}>
      {Object.entries(STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
