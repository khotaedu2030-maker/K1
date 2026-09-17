"use client";

import { useState } from "react";
import AdminDrawer from "@/components/AdminDrawer";

type ParentRow = { id: string; full_name: string; phone: string; email: string | null; created_at: string };
type Detail = {
  parent: ParentRow;
  children: { id: string; firstName: string; grade: number; subscriptionStatus: string | null; cohortTitle: string | null; makeupAvailable: number }[];
  recentPayments: { status: string; amount_sar: number; paid_at: string | null }[];
};

const PAYMENT_STATUS_LABELS: Record<string, string> = { pending: "قيد الانتظار", paid: "مدفوع", failed: "فشل", refunded: "مُسترَد" };
const SUB_STATUS_LABELS: Record<string, string> = { pending_payment: "بانتظار الدفع", active: "فعّال", paused: "موقوف", cancelled: "ملغى", expired: "منتهٍ" };

export default function ParentsTable({ parents, childCountByParent, activeSubByParent }: {
  parents: ParentRow[];
  childCountByParent: Record<string, number>;
  activeSubByParent: Record<string, number>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDrawer(id: string) {
    setOpenId(id);
    setDetail(null);
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/parents/${id}`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر التحميل");
      return;
    }
    setDetail(data);
  }

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr><th>الاسم</th><th>الجوال</th><th>البريد</th><th>الأبناء</th><th>اشتراكات فعّالة</th><th>تاريخ التسجيل</th></tr>
          </thead>
          <tbody>
            {parents.map((p) => (
              <tr key={p.id} onClick={() => openDrawer(p.id)} style={{ cursor: "pointer" }}>
                <td>{p.full_name}</td>
                <td dir="ltr">{p.phone}</td>
                <td dir="ltr">{p.email ?? "—"}</td>
                <td>{childCountByParent[p.id] ?? 0}</td>
                <td>{activeSubByParent[p.id] ?? 0}</td>
                <td>{new Date(p.created_at).toLocaleDateString("ar-SA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminDrawer open={openId !== null} onClose={() => setOpenId(null)} title="ملف ولي الأمر" loading={loading} error={error}>
        {detail && (
          <>
            <div className="admin-drawer-row"><span>الاسم</span><span>{detail.parent.full_name}</span></div>
            <div className="admin-drawer-row"><span>الجوال</span><span dir="ltr">{detail.parent.phone}</span></div>
            <div className="admin-drawer-row"><span>البريد</span><span dir="ltr">{detail.parent.email ?? "—"}</span></div>
            <div className="admin-drawer-row"><span>تاريخ التسجيل</span><span>{new Date(detail.parent.created_at).toLocaleDateString("ar-SA")}</span></div>

            <b style={{ display: "block", marginTop: 18, marginBottom: 8 }}>الأبناء</b>
            {detail.children.length === 0 ? <p style={{ color: "var(--gray)", fontSize: 13 }}>لا يوجد أبناء مسجَّلون.</p> : detail.children.map((c: Detail["children"][number]) => (
              <div key={c.id} className="dashcard" style={{ marginBottom: 8, padding: 12 }}>
                <b>{c.firstName}</b> — الصف {c.grade}
                <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>
                  {c.cohortTitle ? `المجموعة: ${c.cohortTitle}` : "بلا مجموعة"} · {c.subscriptionStatus ? (SUB_STATUS_LABELS[c.subscriptionStatus] ?? c.subscriptionStatus) : "بلا اشتراك"}
                  {c.makeupAvailable > 0 && ` · ${c.makeupAvailable} رصيد تعويض متاح`}
                </div>
              </div>
            ))}

            <b style={{ display: "block", marginTop: 18, marginBottom: 8 }}>آخر المدفوعات</b>
            {detail.recentPayments.length === 0 ? <p style={{ color: "var(--gray)", fontSize: 13 }}>لا مدفوعات بعد.</p> : detail.recentPayments.map((p: Detail["recentPayments"][number], i: number) => (
              <div className="admin-drawer-row" key={i}>
                <span>{PAYMENT_STATUS_LABELS[p.status] ?? p.status}</span>
                <span>{p.amount_sar} ر.س {p.paid_at ? `— ${new Date(p.paid_at).toLocaleDateString("ar-SA")}` : ""}</span>
              </div>
            ))}
          </>
        )}
      </AdminDrawer>
    </>
  );
}
