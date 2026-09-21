import Link from "next/link";
import Shell from "@/components/Shell";
import PauseRequestForm from "./PauseRequestForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// نستخدم هنا فقط (تنسيق تاريخ عربي بسيط لتاريخ خام YYYY-MM-DD، بلا وقت) — لا علاقة له
// بمنطق الاشتراك نفسه، عرض فقط.
function formatPlainDateArabic(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

const statusLabel: Record<string, string> = {
  pending_payment: "بانتظار الدفع",
  active: "فعّال",
  paused: "مجمَّد",
  cancelled: "ملغى",
  expired: "منتهٍ",
  completed: "مكتمل",
};
const pauseStatusLabel: Record<string, string> = {
  requested: "قيد المراجعة",
  approved: "معتمَد",
  rejected: "مرفوض",
  active: "قيد التنفيذ",
  completed: "منتهٍ",
  cancelled: "ملغى",
};

// Type صريح لصف التجميد — بدونه، فرع { data: [] } الاحتياطي في الـTernary أدناه يجعل TypeScript
// يستنتج العنصر كـ never[] (لا سياق نوع لمصفوفة فارغة حرفية)، فيفشل .push() لاحقًا.
type PauseRow = {
  id: string;
  subscription_id: string;
  start_date: string;
  end_date: string;
  status: string;
};

export default async function P() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">تسجيل الدخول مطلوب</span>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: parent } = await supabase.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  const { data: children } = parent ? await supabase.from("children").select("id, first_name").eq("parent_id", parent.id) : { data: [] };
  const childIds = (children ?? []).map((c) => c.id);

  const { data: subscriptions } = childIds.length
    ? await supabase.from("subscriptions").select("id, child_id, plan_id, status, start_date, renewal_date, plans(name)").in("child_id", childIds)
    : { data: [] };

  const subIds = (subscriptions ?? []).map((s) => s.id);
  const { data: pauses } = subIds.length
    ? await supabase.from("subscription_pauses").select("id, subscription_id, start_date, end_date, status").in("subscription_id", subIds).order("created_at", { ascending: false })
    : { data: [] as PauseRow[] };

  const childName = new Map((children ?? []).map((c) => [c.id, c.first_name]));
  const pausesBySub = new Map<string, PauseRow[]>();
  for (const p of (pauses ?? []) as PauseRow[]) {
    if (!pausesBySub.has(p.subscription_id)) pausesBySub.set(p.subscription_id, []);
    pausesBySub.get(p.subscription_id)!.push(p);
  }

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة ولي الأمر</span>
          <h1 className="title" style={{ fontSize: 34 }}>الاشتراك</h1>

          {(!subscriptions || subscriptions.length === 0) && (
            <p className="lead" style={{ marginTop: 20 }}>لا يوجد اشتراك بعد.</p>
          )}

          {(subscriptions ?? []).map((s: any) => (
            <div className="dashcard" key={s.id} style={{ marginBottom: 16 }}>
              <b>{childName.get(s.child_id)} — {s.plans?.name}</b>
              <div className="taskline"><span>الحالة</span><span className="badge">{statusLabel[s.status] ?? s.status}</span></div>
              {s.start_date && <div className="taskline"><span>تاريخ البداية</span><span>{formatPlainDateArabic(s.start_date)}</span></div>}
              {s.renewal_date && <div className="taskline"><span>نهاية الدورة الحالية</span><span>{formatPlainDateArabic(s.renewal_date)}</span></div>}

              {(pausesBySub.get(s.id) ?? []).map((p: any) => (
                <div className="taskline" key={p.id}>
                  <span>تجميد {formatPlainDateArabic(p.start_date)} ← {formatPlainDateArabic(p.end_date)}</span>
                  <span className="badge">{pauseStatusLabel[p.status] ?? p.status}</span>
                </div>
              ))}

              {s.status === "active" && (
                <div style={{ marginTop: 14 }}>
                  <PauseRequestForm subscriptionId={s.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </Shell>
  );
}
