"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "operations_manager", label: "مدير العمليات" },
  { value: "finance_admin", label: "الإدارة المالية" },
  { value: "admin_support", label: "دعم الإدارة" },
];

export default function AdminUserActions({ adminId, currentRole, active, isSelf }: { adminId: string; currentRole: string; active: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "role" | "active">(null);
  const [newRole, setNewRole] = useState(currentRole);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRole() {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 2) return setError("السبب مطلوب");
    if (!window.confirm("سيتم تغيير دور هذا الإداري وتسجيل السبب. هل تريد المتابعة؟")) return;
    setLoading(true); setError(null);
    const response = await fetch("/api/admin/admin-users/role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetAdminId: adminId, newRole, reason: trimmedReason }) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setError(data.error ?? "تعذّر تغيير الدور");
    setMode(null); setReason(""); router.refresh();
  }

  async function submitActive(nextActive: boolean) {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 2) return setError("السبب مطلوب");
    if (!window.confirm(`سيتم ${nextActive ? "تفعيل" : "تعطيل"} هذا الحساب وتسجيل السبب. هل تريد المتابعة؟`)) return;
    setLoading(true); setError(null);
    const response = await fetch("/api/admin/admin-users/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetAdminId: adminId, active: nextActive, reason: trimmedReason }) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setError(data.error ?? "تعذّر تنفيذ الإجراء");
    setMode(null); setReason(""); router.refresh();
  }

  if (mode === "role") return <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
    <select value={newRole} onChange={(event: ChangeEvent<HTMLSelectElement>) => setNewRole(event.target.value)}>{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
    <input dir="rtl" placeholder="سبب التغيير" value={reason} onChange={(event) => setReason(event.target.value)} style={{ width: 140 }} />
    <button className="btn small" disabled={loading} onClick={submitRole}>{loading ? "..." : "تأكيد"}</button>
    <button className="btn small outline" onClick={() => setMode(null)}>×</button>
    {error && <span style={{ color: "var(--p)", fontSize: 12 }}>{error}</span>}
  </div>;

  if (mode === "active") return <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
    <input dir="rtl" placeholder="السبب" value={reason} onChange={(event) => setReason(event.target.value)} style={{ width: 140 }} />
    <button className="btn small" disabled={loading} onClick={() => submitActive(!active)}>{loading ? "..." : active ? "تأكيد التعطيل" : "تأكيد التفعيل"}</button>
    <button className="btn small outline" onClick={() => setMode(null)}>×</button>
    {error && <span style={{ color: "var(--p)", fontSize: 12 }}>{error}</span>}
  </div>;

  return <div style={{ display: "flex", gap: 6 }}>
    <button className="btn small outline" onClick={() => { setMode("role"); setError(null); }}>تغيير الدور</button>
    <button className="btn small outline" disabled={isSelf && active} title={isSelf && active ? "لا يمكن تعطيل حسابك الخاص" : ""} onClick={() => { setMode("active"); setError(null); }}>{active ? "تعطيل" : "تفعيل"}</button>
  </div>;
}