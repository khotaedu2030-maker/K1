"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export default function SubstituteTeacherControl({
  sessionId,
  teachers,
}: {
  sessionId: string;
  teachers: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!teacherId || !reason.trim()) {
      setError("اختر معلمًا واكتب السبب");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, teacherId, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر الحفظ");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) return <button className="btn small outline" onClick={() => setOpen(true)}>تعيين معلم بديل لهذه الجلسة</button>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
      <select value={teacherId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setTeacherId(e.target.value)}>
        <option value="">— اختر معلمًا —</option>
        {teachers.map((t) => <option value={t.id} key={t.id}>{t.full_name}</option>)}
      </select>
      <input placeholder="سبب التبديل (مطلوب)" value={reason} onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)} />
      {error && <span style={{ color: "var(--p)", fontSize: 12 }}>{error}</span>}
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn small" disabled={loading} onClick={submit}>{loading ? "..." : "تأكيد"}</button>
        <button className="btn small outline" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </div>
  );
}
