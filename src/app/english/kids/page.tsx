import Link from "next/link";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">English للأطفال والطلاب</span>
            <h1>ابدأ من المستوى الصحيح.</h1>
            <p className="lead">اختبار For Schools ← تحديد CEFR ← البرنامج المناسب ← اختيار المجموعة ← الدفع.</p>
            <Link className="btn" href="/english/level-test?track=schools">ابدأ الاختبار ←</Link>
          </div>
        </section>
        <section className="section">
          <div className="container">
            <h2>مجموعات صغيرة، لا حصص فردية.</h2>
            <p className="lead">
              نعرض لك المستوى، الأيام، الساعة، عدد المقاعد، تاريخ البداية،
              ومدة البرنامج قبل الالتحاق.
            </p>
            <div className="actions">
              <Link className="btn outline" href="/english/programs">تصفح المجموعات ←</Link>
              <Link className="btn outline" href="/english/private">تدريب فردي بدل مجموعة؟</Link>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}
