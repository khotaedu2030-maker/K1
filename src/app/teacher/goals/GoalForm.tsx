"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function mondayOfThisWeek() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // نعتبر بداية الأسبوع الاثنين
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export default function GoalForm({ childId }: { childId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("عام");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/goals/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId, weekStart: mondayOfThisWeek(), title, description, category }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "تعذّر حفظ الهدف.");
      return;
    }
    router.refresh();
    setTitle("");
    setDescription("");
  }

  return (
    <div className="form" style={{ marginTop: 20 }}>
      <label>
        خطوة هذا الأسبوع
        <input placeholder="مثال: قراءة فقرة قصيرة دون مساعدة" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        تفاصيل (اختياري)
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        التصنيف
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>قراءة</option>
          <option>رياضيات</option>
          <option>استقلالية</option>
          <option>سلوك دراسي</option>
          <option>عام</option>
        </select>
      </label>
      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      <button className="btn" disabled={!title || loading} onClick={submit}>
        {loading ? "جارٍ الحفظ..." : "تعيين هدف الأسبوع"}
      </button>
    </div>
  );
}
