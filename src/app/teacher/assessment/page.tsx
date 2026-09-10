import Link from "next/link";
import Shell from "@/components/Shell";
import AssessmentForm from "./AssessmentForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function P({ searchParams }: { searchParams: Promise<{ child?: string; type?: string }> }) {
  const params = await searchParams;
  const childId = params.child;
  const assessmentType = params.type ?? "monthly_review";

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

  if (!childId) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <p className="lead">افتح هذه الصفحة من قائمة "طلابي" في لوحة المعلم.</p>
            <Link className="btn outline" href="/teacher/students">← طلابي</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: child } = await supabase.from("children").select("first_name").eq("id", childId).maybeSingle();

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">
            {assessmentType === "baseline" ? "التقييم التأسيسي" : "تقييم دوري"}
          </span>
          <h1 className="title" style={{ fontSize: 32 }}>{child?.first_name ?? "الطالب"}</h1>
          <AssessmentForm childId={childId} assessmentType={assessmentType} />
        </div>
      </main>
    </Shell>
  );
}
