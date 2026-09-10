import Link from "next/link";
import Shell from "@/components/Shell";
import SessionReportForm from "./SessionReportForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function P({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const params = await searchParams;
  const sessionId = params.session;

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
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>تقرير الجلسة</h1>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  if (!sessionId) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <h1 className="title" style={{ fontSize: 32 }}>تقرير الجلسة</h1>
            <p className="lead">افتح هذه الصفحة من قائمة جلسات اليوم في لوحة المعلم.</p>
            <Link className="btn outline" href="/teacher">← لوحة المعلم</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, cohort_id, starts_at, cohorts(title)")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <h1 className="title" style={{ fontSize: 32 }}>تقرير الجلسة</h1>
            <p className="lead">هذه الجلسة غير متاحة لحسابك.</p>
            <Link className="btn outline" href="/teacher">← لوحة المعلم</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("child_id, children(first_name)")
    .eq("cohort_id", session.cohort_id)
    .eq("status", "active");

  const students = (subs ?? []).map((s: any) => ({
    childId: s.child_id,
    firstName: s.children?.first_name ?? "طالب",
  }));

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">{(session as any).cohorts?.title ?? "الجلسة"}</span>
          <h1 className="title" style={{ fontSize: 32 }}>تقرير الجلسة السريع</h1>
          <p className="lead">
            {new Date(session.starts_at).toLocaleString("ar-SA", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
          </p>

          {students.length === 0 ? (
            <p style={{ color: "var(--gray)" }}>لا يوجد طلاب مسجّلون في هذه المجموعة حاليًا.</p>
          ) : (
            <SessionReportForm sessionId={session.id} students={students} />
          )}
        </div>
      </main>
    </Shell>
  );
}
