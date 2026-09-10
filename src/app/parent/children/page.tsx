import Link from "next/link";
import Shell from "@/components/Shell";
import EnterStudentModeButton from "./EnterStudentModeButton";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getGradeLabelArabic } from "@/lib/grade-config";

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
  const { data: children } = parent
    ? await supabase.from("children").select("id, first_name, grade").eq("parent_id", parent.id)
    : { data: [] };

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة ولي الأمر</span>
          <h1 className="title" style={{ fontSize: 34 }}>الأبناء</h1>

          {(!children || children.length === 0) && (
            <p className="lead" style={{ marginTop: 20 }}>لا يوجد أبناء مسجّلون بعد.</p>
          )}

          {(children ?? []).map((c) => (
            <div className="dashcard" key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <div>
                <b style={{ fontSize: 18 }}>{c.first_name}</b>
                <p style={{ margin: "4px 0 0", color: "var(--gray)" }}>{getGradeLabelArabic(c.grade)}</p>
              </div>
              <EnterStudentModeButton childId={c.id} />
            </div>
          ))}

          <div className="actions" style={{ marginTop: 24 }}>
            <Link className="btn outline" href="/motabaa/plans">تسجيل طفل جديد ←</Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}
