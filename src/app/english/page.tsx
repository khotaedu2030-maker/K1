import Link from "next/link";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">خُطى English</span>
            <h1>الإنجليزية... خطوة بخطوة.</h1>
            <p className="lead">برامج جماعية عن بُعد، تبدأ من المستوى الصحيح — أو تدريب فردي إذا كان جدولك أو هدفك خاصًا.</p>
            <div className="actions">
              <Link className="btn" href="/english/level-test">اختبار تحديد المستوى ←</Link>
              <Link className="btn outline" href="/english/programs">تصفح المجموعات</Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2>ثلاث طرق للبدء</h2>
            <div className="cards">
              <Link className="card featured" href="/english/level-test">
                <b>الأنسب أولًا</b>
                <h3>اختبار تحديد المستوى</h3>
                <p>خمس دقائق تحدّد مستواك (CEFR) وتقترح عليك المجموعة المناسبة مباشرة.</p>
              </Link>
              <Link className="card" href="/english/programs">
                <h3>البرامج الجماعية</h3>
                <p>مجموعات صغيرة بمستويات وأوقات محدَّدة — General، Conversation، Business، وFor Schools.</p>
              </Link>
              <Link className="card" href="/english/private">
                <h3>التدريب الفردي (Premium)</h3>
                <p>جدول وهدف خاص بك، وليس مجموعة جاهزة — بطلب مباشر.</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="section soft">
          <div className="container">
            <h2>حسب الفئة العمرية</h2>
            <div className="cards">
              <Link className="card" href="/english/kids">
                <h3>الأطفال والطلاب</h3>
                <p>محتوى ومجموعات مصمَّمة لأعمار المدرسة، تبدأ باختبار For Schools.</p>
              </Link>
              <Link className="card" href="/english/adults">
                <h3>البالغون والمهنيون</h3>
                <p>General • Conversation • Business — لمن أنهى المرحلة الدراسية.</p>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}
