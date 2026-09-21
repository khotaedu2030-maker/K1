"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminAccountMenu from "./AdminAccountMenu";

// كل قسم من الـ17 مذكورين صراحةً بالطلب — أي قسم بلا صفحة حقيقية بعد يقود لصفحة تعرض بوضوح
// "قيد التطوير" (لا 404، ولا بيانات وهمية) بدل اختراع محتوى. القسم يبقى بالتنقّل دائمًا حتى
// يعرف الأدمن أن الميزة موجودة على الخارطة، لا مخفية.
const SECTIONS: { label: string; href: string }[] = [
  { label: "نظرة عامة", href: "/admin" },
  { label: "أولياء الأمور", href: "/admin/parents" },
  { label: "الأبناء", href: "/admin/students" },
  { label: "المعلمون", href: "/admin/teachers" },
  { label: "طلبات المعلمين", href: "/admin/teacher-applications" },
  { label: "المجموعات", href: "/admin/groups" },
  { label: "الجلسات", href: "/admin/sessions" },
  { label: "الحضور", href: "/admin/attendance" },
  { label: "مراجعة طلبات التجميد", href: "/admin/subscriptions" },
  { label: "المدفوعات", href: "/admin/payments" },
  { label: "التعويضات", href: "/admin/makeup-credits" },
  { label: "طلبات التسجيل والتواصل", href: "/admin/requests" },
  { label: "الرسائل", href: "/admin/messages" },
  { label: "التقارير", href: "/admin/reports" },
  { label: "الإعدادات", href: "/admin/settings" },
  { label: "الإداريون والصلاحيات", href: "/admin/admins" },
  { label: "سجل العمليات", href: "/admin/audit" },
];

export default function AdminShell({ adminName, children }: { adminName: string; children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="admin-os">
      <header className="admin-os-topbar">
        <button className="admin-os-menu-btn" onClick={() => setDrawerOpen(true)} aria-label="القائمة">☰</button>
        <Link href="/admin" className="admin-os-brand">خُطى — الإدارة</Link>
        <AdminAccountMenu adminName={adminName} />
      </header>

      <div className="admin-os-body">
        <nav className={`admin-os-sidebar${drawerOpen ? " open" : ""}`} aria-label="أقسام الإدارة">
          <div className="admin-os-sidebar-head">
            <span>الأقسام</span>
            <button className="admin-os-close-btn" onClick={() => setDrawerOpen(false)} aria-label="إغلاق">✕</button>
          </div>
          {SECTIONS.map((s) => {
            const active = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`admin-os-nav-link${active ? " active" : ""}`}
                onClick={() => setDrawerOpen(false)}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
        {drawerOpen && <div className="admin-os-backdrop" onClick={() => setDrawerOpen(false)} />}
        <main className="admin-os-content">{children}</main>
      </div>
    </div>
  );
}
