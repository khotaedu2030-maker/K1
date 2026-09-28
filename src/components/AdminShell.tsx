"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminAccountMenu from "./AdminAccountMenu";
import { adminRoleHasPermission } from "@/lib/admin-permissions";

// كل قسم من الـ17 مذكورين صراحةً بالطلب — أي قسم بلا صفحة حقيقية بعد يقود لصفحة تعرض بوضوح
// "قيد التطوير" (لا 404، ولا بيانات وهمية) بدل اختراع محتوى. القسم يبقى بالتنقّل دائمًا حتى
// يعرف الأدمن أن الميزة موجودة على الخارطة، لا مخفية.
// permission غير معرَّف = متاح لكل دور إداري نشط معروف (مثل نظرة عامة). إخفاء الرابط هنا واجهة
// فقط — الحماية الفعلية تبقى دائمًا على مستوى الصفحة/الـAPI (getAdminIdentity/requirePermission).
const SECTIONS: { label: string; href: string; permission?: string }[] = [
  { label: "نظرة عامة", href: "/admin" },
  { label: "الدورات", href: "/admin/cycles", permission: "cohort.manage" },
  { label: "أولياء الأمور", href: "/admin/parents", permission: "parent.context.read" },
  { label: "الأبناء", href: "/admin/students", permission: "student.read" },
  { label: "المعلمون", href: "/admin/teachers", permission: "teacher.manage" },
  { label: "طلبات المعلمين", href: "/admin/teacher-applications", permission: "teacher_application.review" },
  { label: "المجموعات", href: "/admin/groups", permission: "cohort.manage" },
  { label: "الجلسات", href: "/admin/sessions", permission: "session.manage" },
  { label: "الحضور", href: "/admin/attendance", permission: "attendance.read" },
  { label: "مراجعة طلبات التجميد", href: "/admin/subscriptions", permission: "subscription.review" },
  { label: "المدفوعات", href: "/admin/payments", permission: "payment.read" },
  { label: "التعويضات", href: "/admin/makeup-credits", permission: "makeup.manage" },
  { label: "طلبات التسجيل والتواصل", href: "/admin/requests", permission: "request.read" },
  { label: "حالات الدعم", href: "/admin/support", permission: "support.manage" },
  { label: "الاستثناءات التشغيلية", href: "/admin/exceptions", permission: "exception.manage" },
  { label: "الرسائل", href: "/admin/messages", permission: "messages.metadata.read" },
  { label: "التقارير", href: "/admin/reports", permission: "reports.read" },
  { label: "الإعدادات", href: "/admin/settings", permission: "settings.manage" },
  { label: "الإداريون والصلاحيات", href: "/admin/admins", permission: "admin.manage" },
  { label: "سجل العمليات", href: "/admin/audit", permission: "audit.read" },
];

export default function AdminShell({ adminName, role, children }: { adminName: string; role: string; children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const visibleSections = SECTIONS.filter((s) => !s.permission || adminRoleHasPermission(role, s.permission));

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
          {visibleSections.map((s) => {
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
