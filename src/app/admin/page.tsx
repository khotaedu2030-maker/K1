import Link from "next/link";
import Shell from "@/components/Shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// RBAC حقيقي: middleware.ts يتحقق أن هناك جلسة تسجيل دخول أصلًا قبل الوصول لهذا المسار،
// وهنا نتحقق بدقة أن هذا المستخدم تحديدًا موجود في جدول admins — وليس مجرد "مسجّل دخول".
async function getCounts() {
  try {
    const supabase = createSupabaseAdminClient();
    const [{ count: children }, { count: subs }, { count: sessions }, { count: attendance }] = await Promise.all([
      supabase.from("children").select("*", { count: "exact", head: true }),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("sessions").select("*", { count: "exact", head: true }).eq("session_date", new Date().toISOString().slice(0, 10)),
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("status", "present"),
    ]);
    return { children: children ?? 0, subs: subs ?? 0, sessions: sessions ?? 0, attendance: attendance ?? 0, live: true };
  } catch {
    return { children: 0, subs: 0, sessions: 0, attendance: 0, live: false };
  }
}

// روابط التنقّل الأساسية — الصفحات التشغيلية الجاهزة فعليًا فقط للتجربة التجريبية الحالية.
// بقية الأقسام (الطلاب/أولياء الأمور/الجداول/البرامج/المدفوعات/التقارير) لا تزال "قيد التطوير"
// فعليًا (تحقّق مباشر من محتوى كل ملف) — أُزيلت من التنقّل الأساسي حتى لا يصطدم بها مدير
// التجربة التجريبية كطرق مسدودة؛ المسارات نفسها لم تُحذَف، تبقى متاحة مباشرة لمن يحتاج مراجعتها.
const links = [
  ["مجموعات", "/admin/groups"], ["معلمون", "/admin/teachers"], ["اشتراكات", "/admin/subscriptions"],
];

export default async function P() {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  const { data: admin } = user
    ? await authed.from("admins").select("full_name").eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!admin) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">غير مصرَّح</span>
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>هذه الصفحة لحسابات الإدارة فقط</h1>
            <p className="lead">حسابك الحالي غير مسجَّل كأدمن في النظام.</p>
            <Link className="btn outline" href="/">← الرئيسية</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const c = await getCounts();

  return (
    <Shell>
      <main className="section">
        <div className="container">
          <span className="badge">{c.live ? `مرحبًا ${admin.full_name}` : "بلا اتصال DB — أرقام صفرية"}</span>
          <h1 className="title" style={{ fontSize: 34, marginTop: 16 }}>لوحة الإدارة</h1>
          <div className="kpi">
            <div><strong>{c.children}</strong><span>الأبناء المسجّلون</span></div>
            <div><strong>{c.subs}</strong><span>اشتراكات فعّالة</span></div>
            <div><strong>{c.sessions}</strong><span>جلسات اليوم</span></div>
            <div><strong>{c.attendance}</strong><span>حضور مسجّل (تراكمي)</span></div>
          </div>
          <div className="cards" style={{ marginTop: 30 }}>
            {links.map((l) => (
              <Link className="card" href={l[1]} key={l[1]}><h3 style={{ fontSize: 18 }}>{l[0]}</h3></Link>
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
