import Link from "next/link";
import Shell from "@/components/Shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();

  const { data: sessions } = teacher
    ? await supabase
        .from("sessions")
        .select("id, starts_at, status, cohorts(title)")
        .eq("teacher_id", teacher.id)
        .gte("starts_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order("starts_at", { ascending: true })
        .limit(30)
    : { data: [] };

  return (
    <Shell>
      <main className="section">
        <div className="container">
          <span className="eyebrow">لوحة المعلم</span>
          <h1 className="title" style={{ fontSize: 34 }}>الجدول الكامل</h1>

          {(!sessions || sessions.length === 0) && (
            <p className="lead" style={{ marginTop: 20 }}>لا توجد جلسات قادمة مجدولة حاليًا.</p>
          )}

          <div style={{ marginTop: 24 }}>
            {(sessions ?? []).map((s: any) => (
              <div className="session-row" key={s.id}>
                <div>
                  <b>{s.cohorts?.title ?? "مجموعة"}</b>
                  <p style={{ margin: "4px 0 0", color: "var(--gray)" }}>
                    {new Date(s.starts_at).toLocaleString("ar-SA", {
                      weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <Link className="btn small" href={`/teacher/session-report?session=${s.id}`}>
                  {s.status === "completed" ? "عرض التقرير" : "بدء تقرير الجلسة ←"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
