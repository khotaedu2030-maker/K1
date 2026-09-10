import Link from "next/link";
import Shell from "@/components/Shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sessionStatusLabelAr } from "@/lib/arabic-time";

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
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>لوحة المعلم</h1>
            <p className="lead">هذه اللوحة لحسابات المعلمين فقط.</p>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: teacher } = await supabase.from("teachers").select("id, full_name").eq("user_id", user.id).maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const { data: todaySessions } = teacher
    ? await supabase
        .from("sessions")
        .select("id, starts_at, status, cohorts(title)")
        .eq("teacher_id", teacher.id)
        .eq("session_date", today)
    : { data: [] };

  return (
    <Shell>
      <main className="section">
        <div className="container">
          <span className="badge">{teacher ? teacher.full_name : "غير مرتبط بحساب معلم بعد"}</span>
          <h1 className="title" style={{ fontSize: 34, marginTop: 16 }}>لوحة المعلم</h1>

          <div className="dashcard" style={{ marginTop: 20 }}>
            <b>جلسات اليوم</b>
            {todaySessions && todaySessions.length > 0 ? (
              todaySessions.map((s: any) => (
                <div className="session-row" key={s.id}>
                  <div>
                    <b>{s.cohorts?.title ?? "مجموعة"}</b>
                    <p style={{ margin: "4px 0 0", color: "var(--gray)" }}>
                      {s.starts_at ? new Date(s.starts_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : ""}
                      {" • "}
                      <span className={s.status === "completed" ? "ok" : ""}>{sessionStatusLabelAr(s.status)}</span>
                    </p>
                  </div>
                  <Link className="btn small" href={`/teacher/session-report?session=${s.id}`}>
                    {s.status === "completed" ? "عرض التقرير" : "بدء تقرير الجلسة ←"}
                  </Link>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--gray)" }}>لا توجد جلسات مجدولة اليوم.</p>
            )}
          </div>

          <div className="cards" style={{ marginTop: 24 }}>
            <Link className="card" href="/teacher/schedule"><h3 style={{ fontSize: 18 }}>الجدول الكامل</h3></Link>
            <Link className="card" href="/teacher/students"><h3 style={{ fontSize: 18 }}>الطلاب</h3></Link>
            <Link className="card" href="/teacher/session-report"><h3 style={{ fontSize: 18 }}>تقرير جلسة</h3></Link>
            <Link className="card" href="/teacher/messages"><h3 style={{ fontSize: 18 }}>الرسائل</h3></Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}
