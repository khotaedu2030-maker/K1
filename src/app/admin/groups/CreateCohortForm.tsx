"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const GRADES = [4, 5, 6];

export default function CreateCohortForm({
  teachers,
  plans,
  cycles,
  defaultCapacity,
}: {
  teachers: { id: string; full_name: string }[];
  plans: { id: string; name: string; days_per_week: number | null }[];
  cycles?: { id: string; name: string; enabled_grade_bands: string[] | null }[];
  defaultCapacity?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [planId, setPlanId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [capacity, setCapacity] = useState(String(defaultCapacity ?? 4));
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("16:30");
  const [endTime, setEndTime] = useState("17:30");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedPlan = plans.find((p) => p.id === planId);

  function toggleDay(d: number) {
    setDays((prev: number[]) => (prev.includes(d) ? prev.filter((x: number) => x !== d) : [...prev, d].sort()));
  }

  function reset() {
    setTitle(""); setGrade(""); setPlanId(""); setTeacherId(""); setCapacity("4");
    setDays([]); setStartTime("16:30"); setEndTime("17:30"); setMeetingUrl(""); setStatus("open");
  }

  async function submit() {
    setError(null);
    setSuccess(false);

    // التحقق الأساسي هنا للـUX فقط (رسالة فورية) — التحقق الفعلي والوحيد المُعتمَد عليه أمنيًا
    // هو server-side بالكامل داخل /api/admin/cohorts، لا نكرّره بمنطق مختلف هنا.
    if (!title.trim() || !grade || !planId || !capacity || days.length === 0 || !startTime || !endTime) {
      setError("أكمل كل الحقول المطلوبة: الاسم، الصف، الباقة، السعة، الأيام، الوقت.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        grade,
        planId,
        teacherId: teacherId || undefined,
        capacity: Number(capacity),
        daysOfWeek: days,
        startTime,
        endTime,
        meetingUrl: meetingUrl.trim() || undefined,
        status,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "تعذّر إنشاء المجموعة");
      return;
    }
    setSuccess(true);
    reset();
    router.refresh();
  }

  if (!open) {
    return <button className="btn small" onClick={() => setOpen(true)}>+ إنشاء مجموعة جديدة</button>;
  }

  return (
    <div className="dashcard" style={{ marginBottom: 20, maxWidth: 520 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>إنشاء مجموعة جديدة</b>
        <button className="admin-drawer-close" onClick={() => setOpen(false)} aria-label="إغلاق">✕</button>
      </div>

      <div className="form" style={{ marginTop: 12 }}>
        <label>
          اسم المجموعة
          <input value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="مثال: خُطى متابعة 4-6 — المجموعة D" />
        </label>

        <label>
          الصف (نطاق التجربة الحالي: 4-6 فقط)
          <select value={grade} onChange={(e: ChangeEvent<HTMLSelectElement>) => setGrade(Number(e.target.value))}>
            <option value="">— اختر —</option>
            {GRADES.map((g) => <option value={g} key={g}>الصف {g}</option>)}
          </select>
        </label>

        <label>
          الباقة
          <select value={planId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPlanId(e.target.value)}>
            <option value="">— اختر —</option>
            {plans.map((p) => (
              <option value={p.id} key={p.id}>{p.name}{p.days_per_week ? ` (${p.days_per_week} أيام)` : ""}</option>
            ))}
          </select>
          {selectedPlan?.days_per_week != null && (
            <span style={{ fontSize: 12, color: "var(--gray)" }}>
              يجب اختيار {selectedPlan.days_per_week} يومًا بالضبط أدناه ليطابق هذه الباقة.
            </span>
          )}
        </label>

        <label>
          المعلم المسؤول (اختياري الآن، يمكن إسناده لاحقًا)
          <select value={teacherId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setTeacherId(e.target.value)}>
            <option value="">— غير مُسنَد —</option>
            {teachers.map((t) => <option value={t.id} key={t.id}>{t.full_name}</option>)}
          </select>
        </label>

        <label>
          السعة
          <input dir="ltr" inputMode="numeric" value={capacity} onChange={(e: ChangeEvent<HTMLInputElement>) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </label>

        <div>
          <span style={{ fontSize: 14, fontWeight: 700, display: "block", marginBottom: 6 }}>أيام الأسبوع</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                className={`btn small${days.includes(i) ? "" : " outline"}`}
                onClick={() => toggleDay(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label>
          وقت البداية
          <input dir="ltr" type="time" value={startTime} onChange={(e: ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)} />
        </label>
        <label>
          وقت النهاية
          <input dir="ltr" type="time" value={endTime} onChange={(e: ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)} />
        </label>
        <label>
          رابط الجلسة (اختياري، يمكن إضافته لاحقًا)
          <input dir="ltr" value={meetingUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setMeetingUrl(e.target.value)} placeholder="https://..." />
        </label>
        <label>
          حالة التسجيل
          <select value={status} onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as "open" | "closed")}>
            <option value="open">متاح للتسجيل</option>
            <option value="closed">مغلق</option>
          </select>
        </label>

        {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
        {success && <p style={{ color: "var(--t)", fontWeight: 700 }}>تم إنشاء المجموعة بنجاح.</p>}

        <div className="actions">
          <button className="btn small" disabled={loading} onClick={submit}>{loading ? "جارٍ الإنشاء..." : "إنشاء المجموعة"}</button>
          <button className="btn small outline" onClick={() => setOpen(false)}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
