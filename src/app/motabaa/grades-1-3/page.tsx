import Link from "next/link";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">الصفوف 1–3 • حتى 3 طلاب</span>
          <h1 className="title" style={{ fontSize: 40 }}>التأسيس والمتابعة الموجَّهة</h1>
          <p className="lead">
            متابعة بعد المدرسة تبني عادات دراسية سليمة من البداية — ترتيب الواجبات، تثبيت
            أساسيات القراءة والكتابة، ودعم مستمر بجلسات أكثر تفاعلية تناسب عمر الطفل الصغير.
          </p>
          <Link className="btn" href="/motabaa/plans">استعرض الخطط ←</Link>
        </div>
      </main>
    </Shell>
  );
}
