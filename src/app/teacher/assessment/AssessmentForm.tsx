"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Level = "needs_support" | "age_appropriate" | "advanced";
const levelOptions: { value: Level; label: string }[] = [
  { value: "needs_support", label: "يحتاج دعمًا" },
  { value: "age_appropriate", label: "مناسب لعمره" },
  { value: "advanced", label: "متقدّم" },
];
const dims: { key: string; label: string }[] = [
  { key: "readingLevel", label: "القراءة" },
  { key: "writingSpellingLevel", label: "الكتابة والإملاء" },
  { key: "mathematicsLevel", label: "الرياضيات" },
  { key: "englishLevel", label: "الإنجليزية" },
  { key: "focusLevel", label: "التركيز" },
  { key: "independenceLevel", label: "الاستقلالية العامة" },
];
const independenceDims: { key: string; label: string }[] = [
  { key: "task_management", label: "إدارة المهام" },
  { key: "task_initiation", label: "المبادرة بالبدء" },
  { key: "help_seeking", label: "طلب المساعدة عند الحاجة (وليس دائمًا)" },
  { key: "task_completion", label: "إتمام المهمة كاملة" },
  { key: "time_organization", label: "تنظيم الوقت" },
];

export default function AssessmentForm({ childId, assessmentType }: { childId: string; assessmentType: string }) {
  const router = useRouter();
  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [independence, setIndependence] = useState<Record<string, number>>({
    task_management: 3, task_initiation: 3, help_seeking: 3, task_completion: 3, time_organization: 3,
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/assessment/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childId,
        assessmentType,
        ...levels,
        teacherNotes: notes,
        independence,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "تعذّر حفظ التقييم.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/teacher/students"), 1500);
  }

  if (done) {
    return (
      <div className="dashcard" style={{ textAlign: "center" }}>
        <h2 style={{ color: "var(--t)" }}>تم حفظ التقييم ✓</h2>
      </div>
    );
  }

  return (
    <div className="dashcard">
      <h3 style={{ marginTop: 0 }}>المستوى الأكاديمي</h3>
      {dims.map((d) => (
        <div key={d.key} style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 800, display: "block", marginBottom: 6 }}>{d.label}</label>
          <div className="chips" style={{ margin: 0 }}>
            {levelOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={levels[d.key] === opt.value ? "on" : ""}
                onClick={() => setLevels((prev) => ({ ...prev, [d.key]: opt.value }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <h3 style={{ marginTop: 30 }}>KHOTA Independence Score</h3>
      {independenceDims.map((d) => (
        <div key={d.key} style={{ marginBottom: 14 }}>
          <label style={{ fontWeight: 800, display: "block", marginBottom: 4 }}>
            {d.label} ({independence[d.key]}/5)
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={independence[d.key]}
            onChange={(e) => setIndependence((prev) => ({ ...prev, [d.key]: Number(e.target.value) }))}
          />
        </div>
      ))}

      <label style={{ fontWeight: 800, display: "block", margin: "20px 0 6px" }}>ملاحظات المعلم</label>
      <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      <button className="btn" style={{ marginTop: 16 }} disabled={loading} onClick={submit}>
        {loading ? "جارٍ الحفظ..." : "حفظ التقييم"}
      </button>
    </div>
  );
}
