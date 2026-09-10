import Link from "next/link";
import Shell from "@/components/Shell";
import Reveal from "@/components/Reveal";
import EditorialSplit from "@/components/EditorialSplit";

export default function P() {
  return (
    <Shell>
      <main>
        <section className="section">
          <div className="container">
            <Reveal>
              <span className="eyebrow">كيف تعمل خُطى</span>
              <h1 className="title">من بداية الجلسة حتى وصول التقرير.</h1>
              <p className="lead" style={{ maxWidth: 620 }}>
                خُطى لا تحل الواجب عن الطالب، ولا تقدّم شرحًا لمادة دراسية — تساعده على تنظيم
                وقته، إنجاز مهامه بتركيز، والاستعداد لليوم التالي.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <div className="progression progression-3" style={{ marginTop: 48 }}>
                <div className="progression-item">
                  <span className="progression-num">قبل الجلسة</span>
                  <h3>تحديد الأولويات</h3>
                </div>
                <div className="progression-item">
                  <span className="progression-num">بداية الجلسة</span>
                  <h3>ترتيب المهام</h3>
                </div>
                <div className="progression-item">
                  <span className="progression-num">أثناء الجلسة</span>
                  <h3>عمل مستقل وتركيز</h3>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <EditorialSplit image="/images/khota-live-session.webp" alt="طالب في جلسة تركيز مباشرة" objectPosition="42% 20%">
          <Reveal>
            <span className="eyebrow">أثناء الجلسة</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)" }}>معلم يوجّه، لا يُملي.</h2>
            <p className="lead">الطالب يعمل بنفسه على مهامه؛ المعلم يتدخّل فقط عند التعثر الحقيقي — هذا ما يبني الاستقلالية.</p>
          </Reveal>
        </EditorialSplit>

        <EditorialSplit image="/images/khota-progress.webp" alt="ولي أمر يتابع تقدّم ابنه بعد الجلسة" objectPosition="32% 30%" reverse contentBg="var(--card)">
          <Reveal>
            <span className="eyebrow">نهاية الجلسة، وما بعدها</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)" }}>مراجعة الإنجاز، ثم تصلك أنت.</h2>
            <p className="lead">يراجع الطالب ما أنجزه وما يحتاجه غدًا، وتصلك بطاقة مختصرة تعرض تقدّمه.</p>
            <Link className="btn" href="/motabaa/plans">استعرض الخطط ←</Link>
          </Reveal>
        </EditorialSplit>
      </main>
    </Shell>
  );
}
