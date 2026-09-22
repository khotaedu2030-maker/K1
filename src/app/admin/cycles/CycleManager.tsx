"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Cycle = { id: string; name: string; start_date: string; end_date: string; registration_start: string | null; registration_end: string | null; enabled_grade_bands: string[] | null; status: string };
type Cohort = { id: string; title: string; cycle_id: string; status: string; capacity: number };
const bands = ["1-3", "4-6", "7-9", "10-12"];
const labels: Record<string, string> = { draft: "مسودة", registration_open: "التسجيل مفتوح", in_progress: "جارية", completed: "مكتملة", archived: "مؤرشفة" };

export default function CycleManager({ initialCycles, initialCohorts }: { initialCycles: Cycle[]; initialCohorts: Cohort[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", registrationStart: "", registrationEnd: "", enabledGradeBands: bands });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", startDate: "", endDate: "", registrationStart: "", registrationEnd: "" });

  async function request(url: string, options: RequestInit) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "تعذّر حفظ الدورة");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ الدورة");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createCycle() {
    const ok = await request("/api/admin/cycles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (ok) setForm({ name: "", startDate: "", endDate: "", registrationStart: "", registrationEnd: "", enabledGradeBands: bands });
  }

  async function updateCycle(cycle: Cycle, patch: Partial<Cycle> & { status?: string }) {
    await request("/api/admin/cycles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId: cycle.id, ...patch }) });
  }

  async function completeCycle(cycle: Cycle) {
    if (!window.confirm(`تأكيد إكمال الدورة «${cycle.name}»؟`)) return;
    await request("/api/admin/cycles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", cycleId: cycle.id }) });
  }

  function beginEdit(cycle: Cycle) {
    setEditingId(cycle.id);
    setEdit({ name: cycle.name, startDate: cycle.start_date, endDate: cycle.end_date, registrationStart: cycle.registration_start ?? "", registrationEnd: cycle.registration_end ?? "" });
    setError(null);
  }

  async function saveEdit(cycle: Cycle) {
    const ok = await request("/api/admin/cycles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId: cycle.id, ...edit }) });
    if (ok) setEditingId(null);
  }

  return (
    <div>
      <div className="dashcard" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20 }}>إنشاء دورة</h2>
        <div className="form">
          <label>اسم الدورة<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>تاريخ البداية<input dir="ltr" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label>تاريخ النهاية<input dir="ltr" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
          <label>بداية التسجيل<input dir="ltr" type="date" value={form.registrationStart} onChange={(e) => setForm({ ...form, registrationStart: e.target.value })} /></label>
          <label>نهاية التسجيل<input dir="ltr" type="date" value={form.registrationEnd} onChange={(e) => setForm({ ...form, registrationEnd: e.target.value })} /></label>
          <fieldset><legend>النطاقات الدراسية</legend>{bands.map((band) => <label key={band}><input type="checkbox" checked={form.enabledGradeBands.includes(band)} onChange={(e) => setForm({ ...form, enabledGradeBands: e.target.checked ? [...form.enabledGradeBands, band] : form.enabledGradeBands.filter((value) => value !== band) })} /> {band}</label>)}</fieldset>
          <button className="btn" type="button" disabled={saving} onClick={createCycle}>{saving ? "جارٍ الحفظ..." : "إنشاء الدورة"}</button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: "var(--p)", marginBottom: 16 }}>{error}</p>}
      <div>
        {initialCycles.map((cycle) => {
          const cohorts = initialCohorts.filter((cohort) => cohort.cycle_id === cycle.id);
          const editable = cycle.status !== "completed" && cycle.status !== "archived";
          return (
            <div className="dashcard" key={cycle.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                <div><h2 style={{ margin: 0, fontSize: 20 }}>{cycle.name}</h2><p style={{ color: "var(--gray)", margin: "6px 0" }}>{cycle.start_date} ← {cycle.end_date}</p></div>
                <span className="badge">{labels[cycle.status] ?? cycle.status}</span>
              </div>
              <p style={{ color: "var(--gray)" }}>المجموعات المرتبطة: {cohorts.length}</p>
              {cohorts.length > 0 && <ul>{cohorts.map((cohort) => <li key={cohort.id}>{cohort.title} — {cohort.capacity} مقاعد — {cohort.status}</li>)}</ul>}
              {editable && <div className="actions">
                <button className="btn small outline" type="button" disabled={saving} onClick={() => beginEdit(cycle)}>تعديل</button>
                {cycle.status === "draft" && <button className="btn small" type="button" disabled={saving} onClick={() => updateCycle(cycle, { status: "registration_open" })}>فتح التسجيل</button>}
                {cycle.status === "registration_open" && <button className="btn small" type="button" disabled={saving} onClick={() => updateCycle(cycle, { status: "in_progress" })}>بدء الدورة</button>}
                {cycle.status === "in_progress" && <button className="btn small outline" type="button" disabled={saving} onClick={() => completeCycle(cycle)}>إكمال الدورة</button>}
              </div>}
              {editingId === cycle.id && <div className="form" style={{ marginTop: 12 }}>
                <label>اسم الدورة<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
                <label>تاريخ البداية<input dir="ltr" type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /></label>
                <label>تاريخ النهاية<input dir="ltr" type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} /></label>
                <label>بداية التسجيل<input dir="ltr" type="date" value={edit.registrationStart} onChange={(e) => setEdit({ ...edit, registrationStart: e.target.value })} /></label>
                <label>نهاية التسجيل<input dir="ltr" type="date" value={edit.registrationEnd} onChange={(e) => setEdit({ ...edit, registrationEnd: e.target.value })} /></label>
                <div className="actions"><button className="btn small" type="button" disabled={saving} onClick={() => saveEdit(cycle)}>حفظ التعديل</button><button className="btn small outline" type="button" onClick={() => setEditingId(null)}>إلغاء</button></div>
              </div>}
              {cycle.status === "completed" && <p style={{ color: "var(--gray)" }}>الدورة مكتملة ولا يمكن تعديلها.</p>}
            </div>
          );
        })}
        {initialCycles.length === 0 && <p className="admin-empty-state">لا توجد دورات بعد.</p>}
      </div>
    </div>
  );
}
