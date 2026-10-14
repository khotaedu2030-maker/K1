"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "contact" | "premium";

const OPTIONS: Record<Kind, { value: string; label: string }[]> = {
  contact: [
    { value: "new", label: "جديدة" },
    { value: "reviewing", label: "قيد المراجعة" },
    { value: "closed", label: "مغلقة" },
  ],
  premium: [
    { value: "new", label: "جديد" },
    { value: "contacted", label: "تم التواصل" },
    { value: "converted", label: "تم التحويل" },
    { value: "closed", label: "مغلق" },
  ],
};

export default function RequestStatusActions({
  id,
  kind,
  currentStatus,
}: {
  id: string;
  kind: Kind;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextStatus: string) {
    if (nextStatus === status || saving) return;
    const previous = status;
    setStatus(nextStatus);
    setSaving(true);
    setError(null);

    const response = await fetch("/api/admin/requests/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, kind, status: nextStatus }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);

    if (!response?.ok) {
      setStatus(previous);
      setError(data?.error ?? "تعذّر حفظ الحالة");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <select
        value={status}
        disabled={saving}
        onChange={(event) => void save(event.target.value)}
        aria-label="حالة الطلب"
        style={{ padding: "7px 9px", borderRadius: 9, border: "1px solid var(--line)", fontFamily: "inherit" }}
      >
        {OPTIONS[kind].map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {error && <div role="alert" style={{ color: "var(--p)", fontSize: 11, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
