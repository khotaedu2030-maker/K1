"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Student = { childId: string; firstName: string };

const subjectOptions = ["رياضيات", "لغتي", "English", "مراجعة عامة"];

type RowState = {
  subjects: string[];
  independence: number;
  focus: number;
  readiness: string;
  note: string;
  needsSpecialist: boolean;
  specialistSubject: string;
  materialsReady: boolean;
  tomorrowTestStatus: string;
  remainingReview: string;
  readinessStatus: "ready" | "needs_light_review" | "needs_attention";
  attended: boolean;
  absenceReason: "excused" | "unexcused" | "exceptional_approved";
};

const defaultRow: RowState = {
  subjects: [],
  independence: 3,
  focus: 3,
  readiness: "جيدة",
  note: "",
  needsSpecialist: false,
  specialistSubject: "",
  materialsReady: true,
  tomorrowTestStatus: "",
  remainingReview: "",
  readinessStatus: "ready",
  attended: true,
  absenceReason: "unexcused",
};

export default function SessionReportForm({ sessionId, students }: { sessionId: string; students: Student[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>(
    Object.fromEntries(students.map((s) => [s.childId, { ...defaultRow }]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateRow(childId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [childId]: { ...prev[childId], ...patch } }));
  }

  function toggleSubject(childId: string, subject: string) {
    const current = rows[childId].subjects;
    const next = current.includes(subject) ? current.filter((s) => s !== subject) : [...current, subject];
    updateRow(childId, { subjects: next });
  }

  async function submit() {
    setLoading(true);
    setError(null);

    const entries = students.map((s) => {
      const r = rows[s.childId];
      return {
        childId: s.childId,
        subjectsCompleted: r.subjects,
        independenceRating: r.independence,
        focusRating: r.focus,
        tomorrowReadiness: r.readiness,
        teacherNote: r.note,
        needsSpecialist: r.needsSpecialist,
        specialistSubject: r.specialistSubject || undefined,
        materialsReady: r.materialsReady,
        tomorrowTestStatus: r.tomorrowTestStatus,
        remainingReview: r.remainingReview,
        readinessStatus: r.readinessStatus,
        attended: r.attended,
        absenceReason: r.attended ? undefined : r.absenceReason,
      };
    });

    const res = await fetch("/api/session-report/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, entries }),
    });
    setLoading(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "تعذّر حفظ التقرير.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/teacher"), 1500);
  }

  if (done) {
    return (
      <div className="dashcard" style={{ textAlign: "center" }}>
        <h2 style={{ color: "var(--t)" }}>تم حفظ التقرير ✓</h2>
      </div>
    );
  }

  return (
    <div>
      {students.map((s) => {
        const r = rows[s.childId];
        return (
          <div className="dashcard" key={s.childId} style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>{s.firstName}</h3>

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                className={r.attended ? "btn small" : "btn small outline"}
                onClick={() => updateRow(s.childId, { attended: true })}
              >
                حضر ✓
              </button>
              <button
                type="button"
                className={!r.attended ? "btn small" : "btn small outline"}
                onClick={() => updateRow(s.childId, { attended: false })}
              >
                غاب
              </button>
            </div>

            {!r.attended && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 800, display: "block", marginBottom: 6 }}>سبب الغياب</label>
                <select
                  value={r.absenceReason}
                  onChange={(e) => updateRow(s.childId, { absenceReason: e.target.value as RowState["absenceReason"] })}
                >
                  <option value="unexcused">غير مبرَّر (لا يولّد تعويضًا)</option>
                  <option value="excused">مبرَّر (يولّد رصيد تعويض)</option>
                  <option value="exceptional_approved">حالة استثنائية معتمدة (يولّد رصيد تعويض)</option>
                </select>
              </div>
            )}

            {r.attended && (
              <>
            <label style={{ fontWeight: 800, display: "block", margin: "14px 0 6px" }}>ماذا تمت مراجعته؟</label>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {subjectOptions.map((subj) => (
                <span key={subj} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={r.subjects.includes(subj)}
                    onChange={() => toggleSubject(s.childId, subj)}
                  />
                  {subj}
                </span>
              ))}
            </div>

            <label style={{ fontWeight: 800, display: "block", margin: "16px 0 6px" }}>
              مؤشر الاستقلالية ({r.independence}/5)
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={r.independence}
              onChange={(e) => updateRow(s.childId, { independence: Number(e.target.value) })}
            />

            <label style={{ fontWeight: 800, display: "block", margin: "16px 0 6px" }}>
              التركيز ({r.focus}/5)
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={r.focus}
              onChange={(e) => updateRow(s.childId, { focus: Number(e.target.value) })}
            />

            <label style={{ fontWeight: 800, display: "block", margin: "16px 0 6px" }}>الجاهزية للغد</label>
            <select value={r.readiness} onChange={(e) => updateRow(s.childId, { readiness: e.target.value })}>
              <option>ممتازة</option>
              <option>جيدة</option>
              <option>تحتاج مراجعة إضافية</option>
            </select>

            <label style={{ fontWeight: 800, display: "block", margin: "16px 0 6px" }}>ملاحظة لولي الأمر</label>
            <textarea rows={3} value={r.note} onChange={(e) => updateRow(s.childId, { note: e.target.value })} />

            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, fontWeight: 800 }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={r.needsSpecialist}
                onChange={(e) => updateRow(s.childId, { needsSpecialist: e.target.checked })}
              />
              يحتاج جلسة تقوية فردية (تُفعّل توصية في حساب ولي الأمر)
            </label>

            {r.needsSpecialist && (
              <input
                style={{ marginTop: 10 }}
                placeholder="المادة التي يحتاج فيها الدعم (مثال: الكسور)"
                value={r.specialistSubject}
                onChange={(e) => updateRow(s.childId, { specialistSubject: e.target.value })}
              />
            )}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
              <span className="badge">Tomorrow Ready — خطوة Prepare</span>

              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, fontWeight: 800 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={r.materialsReady}
                  onChange={(e) => updateRow(s.childId, { materialsReady: e.target.checked })}
                />
                الأدوات/الكتب جاهزة للغد
              </label>

              <label style={{ fontWeight: 800, display: "block", margin: "14px 0 6px" }}>حالة اختبار الغد (إن وجد)</label>
              <input
                placeholder="مثال: اختبار رياضيات — تم التجهيز"
                value={r.tomorrowTestStatus}
                onChange={(e) => updateRow(s.childId, { tomorrowTestStatus: e.target.value })}
              />

              <label style={{ fontWeight: 800, display: "block", margin: "14px 0 6px" }}>مراجعة متبقية قبل الغد</label>
              <input
                placeholder="مثال: 10 دقائق مراجعة جدول الضرب"
                value={r.remainingReview}
                onChange={(e) => updateRow(s.childId, { remainingReview: e.target.value })}
              />

              <label style={{ fontWeight: 800, display: "block", margin: "14px 0 6px" }}>حالة الجاهزية</label>
              <select
                value={r.readinessStatus}
                onChange={(e) => updateRow(s.childId, { readinessStatus: e.target.value as RowState["readinessStatus"] })}
              >
                <option value="ready">جاهز</option>
                <option value="needs_light_review">يحتاج مراجعة خفيفة</option>
                <option value="needs_attention">يحتاج انتباهًا</option>
              </select>
            </div>
              </>
            )}
          </div>
        );
      })}

      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      <button className="btn" disabled={loading} onClick={submit}>
        {loading ? "جارٍ الحفظ..." : "حفظ التقرير"}
      </button>
    </div>
  );
}
