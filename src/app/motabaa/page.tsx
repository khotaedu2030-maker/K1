import Image from "next/image";
import Link from "next/link";
import Shell from "@/components/Shell";
import Reveal from "@/components/Reveal";
import GradeGrid, { type GradeBand } from "@/components/GradeGrid";
import EditorialSplit from "@/components/EditorialSplit";

const gradeBands: GradeBand[] = [
  { band: "الصفوف 1–3", desc: "متابعة أقرب تبني عادات الدراسة خطوة بخطوة.", image: "/images/khota-grade-1-3.webp", objectPosition: "50% 10%" },
  { band: "الصفوف 4–6", desc: "استقلالية أكبر، مع تنظيم للمهام والأولويات.", image: "/images/khota-grade-4-6.webp", objectPosition: "50% 14%" },
  { band: "الصفوف 7–9", desc: "جلسات تركيز لإدارة المسؤوليات والاستعداد لما هو قادم.", image: "/images/khota-grade-7-9.webp", objectPosition: "50% 8%" },
  { band: "الصفوف 10–12", desc: "تنظيم أكثر نضجًا للمهام والاختبارات والأهداف.", image: "/images/khota-grade-10-12.webp", objectPosition: "50% 18%" },
];

export default function P() {
  return (
    <Shell transparentHeader>
      <main>
        <section className="hero-editorial-v28" style={{ minHeight: "72vh" }}>
          <div className="bg">
            <Image
              src="/images/khota-grade-4-6.webp"
              alt="طالب يرتّب مهامه الدراسية باستقلالية"
              fill
              sizes="100vw"
              style={{ objectFit: "cover", objectPosition: "50% 14%" }}
              priority
            />
          </div>
          <div className="container hero-editorial-v28-content">
            <Reveal>
              <span className="eyebrow" style={{ color: "var(--g)" }}>خُطى متابعة</span>
              <h1 style={{ fontSize: "clamp(34px,5.5vw,66px)" }}>
                متابعة واضحة بعد المدرسة.
                <br />
                ووقت أهدأ للأسرة مساءً.
              </h1>
              <p className="lead">متابعة منظّمة للابتدائي، وجلسات تركيز للمتوسط والثانوي — عن بُعد.</p>
              <div className="actions">
                <Link className="btn" href="/motabaa/plans">استعرض الخطط ←</Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="editorial-statement">
          <div className="container">
            <Reveal>
              <span className="eyebrow">بعد المدرسة</span>
              <h2>يبدأ وقتٌ أوضح للإنجاز.</h2>
              <p>مهام ومراجعة واستعداد لليوم التالي، ضمن خطوات ثابتة تساعد الطالب على معرفة ما عليه وإنجازه.</p>
            </Reveal>
          </div>
        </section>

        <EditorialSplit image="/images/khota-live-session.webp" alt="طالب في جلسة تركيز" objectPosition="42% 20%">
          <Reveal>
            <span className="eyebrow">الجلسة</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)" }}>الطالب يعمل، والمعلم يوجّه.</h2>
            <p className="lead">يبدأ الطالب بأولوياته، يعمل باستقلالية، ويتدخل المعلم عندما يحتاج توجيهًا حقيقيًا.</p>
          </Reveal>
        </EditorialSplit>

        <GradeGrid bands={gradeBands} />

        <EditorialSplit image="/images/khota-parent-experience.webp" alt="ولي أمر يطّلع على تقرير طفله" objectPosition="35% 25%" reverse contentBg="var(--card)">
          <Reveal>
            <span className="eyebrow">ولي الأمر</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)" }}>صورة واضحة بعد كل جلسة.</h2>
            <p className="lead">بعد كل جلسة تصلك بطاقة مختصرة: ماذا أُنجز، وماذا يحتاج غدًا.</p>
          </Reveal>
        </EditorialSplit>

        <section className="section">
          <div className="container">
            <Reveal>
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: 30 }}>اختر صف طفلك، ثم الخطة، ثم المجموعة.</h2>
                <p className="lead" style={{ margin: "12px auto 24px" }}>ثلاث خطوات، وتصل لأول جلسة.</p>
                <Link className="btn" href="/motabaa/plans">استعرض الخطط ←</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </Shell>
  );
}
