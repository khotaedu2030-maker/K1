"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export default function CohortOperationsForm({
  cohortId,
  currentMeetingUrl,
  currentTeacherId,
  currentCapacity,
  currentStatus,
  teachers,
}: {
  cohortId: string;
  currentMeetingUrl: string | null;
  currentTeacherId: string | null;
  currentCapacity: number;
  currentStatus: string;
  teachers: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState(currentMeetingUrl ?? "");
  const [teacherId, setTeacherId] = useState(currentTeacherId ?? "");
  const [capacity, setCapacity] = useState(String(currentCapacity));
  const [status, setStatus] = useState(currentStatus === "closed" ? "closed" : "open");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/cohort-operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohortId, meetingUrl, teacherId, capacity, status }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر الحفظ");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn small outline" onClick={() => setOpen(true)}>
        {currentMeetingUrl && currentTeacherId ? "تعديل" : "إكمال البيانات التشغيلية"}
      </button>
    );
  }

  return (
    <div className="form" style={{ marginTop: 10 }}>
      <label>
        السعة
        <input
          dir="ltr"
          inputMode="numeric"
          value={capacity}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 2))}
        />
      </label>
      <label>
        حالة التسجيل
        <select value={status} onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value)}>
          <option value="open">متاح للتسجيل</option>
          <option value="closed">مغلق يدويًا</option>
        </select>
      </label>
      <label>
        رابط الجلسة (Zoom/Teams)
        <input dir="ltr" value={meetingUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setMeetingUrl(e.target.value)} placeholder="https://..." />
      </label>
      <label>
        المعلم المسؤول
        <select value={teacherId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setTeacherId(e.target.value)}>
          <option value="">— غير مُسنَد —</option>
          {teachers.map((t) => (
            <option value={t.id} key={t.id}>{t.full_name}</option>
          ))}
        </select>
      </label>
      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      <div className="actions">
        <button className="btn small" disabled={loading} onClick={save}>
          {loading ? "جارٍ الحفظ..." : "حفظ"}
        </button>
        <button className="btn small outline" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </div>
  );
}
