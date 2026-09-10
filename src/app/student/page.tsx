import { redirect } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import { getActiveStudentSession } from "@/lib/student-mode";

export default async function P() {
  const session = await getActiveStudentSession();
  if (session) redirect("/student/today");

  // لا توجد جلسة طالب نشطة — يحدث هذا عادة بعد انتهاء الصلاحية (6 ساعات) أو قبل الدخول أصلًا.
  return (
    <Shell>
      <main className="placeholder-page">
        <div className="narrow">
          <span className="badge">لا توجد مساحة طالب نشطة</span>
          <h1 className="title" style={{ fontSize: 30, marginTop: 16 }}>اطلب من ولي الأمر تفعيل الدخول</h1>
          <p className="lead">من لوحة ولي الأمر ← الأبناء ← دخول مساحة الطالب.</p>
          <Link className="btn outline" href="/parent/children">← الأبناء</Link>
        </div>
      </main>
    </Shell>
  );
}
