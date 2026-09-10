"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CohortOperationsForm({
  cohortId,
  currentMeetingUrl,
  currentTeacherId,
  teachers,
}: {
  cohortId: string;
  currentMeetingUrl: string | null;
  currentTeacherId: string | null;
  teachers: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState(currentMeetingUrl ?? "");
  const [teacherId, setTeacherId] = useState(currentTeacherId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/cohort-operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohortId, meetingUrl, teacherId }),
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
        رابط الجلسة (Zoom/Teams)
        <input dir="ltr" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://..." />
      </label>
      <label>
        المعلم المسؤول
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
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
