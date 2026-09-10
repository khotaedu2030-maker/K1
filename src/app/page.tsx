import Image from "next/image";
import Link from "next/link";
import Shell from "@/components/Shell";
import Reveal from "@/components/Reveal";
import GradeGrid, { type GradeBand } from "@/components/GradeGrid";
import EditorialSplit from "@/components/EditorialSplit";
import HeroStoryRail, { type HeroStory } from "@/components/HeroStoryRail";

const heroStories: HeroStory[] = [
  {
    label: "بعد المدرسة",
    image: "/images/khota-hero.webp",
    alt: "طالب يرتب أولوياته الدراسية في بيئة منزلية هادئة",
    objectPosition: "50% 12%",
    h1: ["بعد المدرسة،", "تبدأ خُطى."],
    lead: "خُطى تساعد الطالب على ترتيب أولوياته، إنجاز مهامه، والاستعداد للغد، مع متابعة واضحة ومطمئنة لولي الأمر.",
    ctaLabel: "ابدأ مع خُطى",
    ctaHref: "/start",
    secondaryLabel: "كيف تعمل خُطى؟",
    secondaryHref: "/motabaa/how-it-works",
  },
  {
    label: "خُطى معه",
    image: "/images/khota-grade-7-9.webp",
    alt: "طالب متوسط يعمل بتركيز على مهامه",
    objectPosition: "50% 8%",
    h1: ["خُطى", "تكبر معه."],
    lead: "من التأسيس في الابتدائي إلى جلسات التركيز في الثانوي — أسلوب المتابعة يتطوّر مع كل مرحلة.",
    ctaLabel: "تعرّف على المراحل",
    ctaHref: "/#stages",
  },
  {
    label: "لولي الأمر",
    image: "/images/khota-progress.webp",
    alt: "ولي أمر يتابع تقدّم ابنه من المنزل",
    objectPosition: "32% 25%",
    h1: ["وأنت تعرف", "كيف يتقدّم."],
    lead: "بطاقة مختصرة تصلك بعد كل جلسة — بلا ملاحقة يومية.",
    ctaLabel: "شاهد لوحة ولي الأمر",
    ctaHref: "/parent",
  },
  {
    label: "جلسات التركيز",
    image: "/images/khota-grade-10-12.webp",
    alt: "طالب ثانوي في جلسة تركيز مستقلة",
    objectPosition: "50% 15%",
    h1: ["تنظيم،", "لا تدريس إضافي."],
    lead: "جلسات تركيز تساعده على ترتيب مسؤولياته والاستعداد لما هو قادم.",
    ctaLabel: "استعرض الخطط",
    ctaHref: "/motabaa/plans",
  },
];

const gradeBands: GradeBand[] = [
  { band: "الصفوف 1–3", desc: "متابعة أقرب تساعده على بناء عادات الدراسة خطوة بخطوة.", image: "/images/khota-grade-1-3.webp", objectPosition: "50% 10%" },
  { band: "الصفوف 4–6", desc: "مساحة أكبر للاستقلالية مع تنظيم المهام والأولويات.", image: "/images/khota-grade-4-6.webp", objectPosition: "50% 14%" },
  { band: "الصفوف 7–9", desc: "جلسات التركيز تساعده على إدارة مسؤولياته والاستعداد لما هو قادم.", image: "/images/khota-grade-7-9.webp", objectPosition: "50% 8%" },
  { band: "الصفوف 10–12", desc: "تنظيم أكثر نضجًا للمهام والاختبارات والأهداف الدراسية.", image: "/images/khota-grade-10-12.webp", objectPosition: "50% 18%" },
];

const progression = [
  ["01", "يعرف"],
  ["02", "يرتب"],
  ["03", "ينجز"],
  ["04", "يستعد"],
];

const sessionSteps = [
  "يحدد الطالب ما يحتاج إنجازه",
  "يرتب أولوياته مع المعلم",
  "يعمل باستقلالية وتركيز",
  "يراجع ما أنجزه وما يحتاجه غدًا",
];

export default function Home() {
  return (
    <Shell transparentHeader>
      <main>
        {/* ---------- Scene 01: Hero + Story Rail ---------- */}
        <section className="hero-editorial-v28">
          <HeroStoryRail stories={heroStories} />
        </section>

        {/* ---------- Scene 02: مشكلة الأسرة ---------- */}
        <section className="editorial-statement">
          <div className="container">
            <Reveal>
              <span className="eyebrow">المشكلة</span>
              <h2>
                مو كل طالب يحتاج
                <br />
                درسًا إضافيًا.
              </h2>
              <p>
                أحيانًا يحتاج أن يعرف ماذا عليه، ومن أين يبدأ.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- Scene 03: ماذا تفعل خُطى ---------- */}
        <section className="section soft">
          <div className="container">
            <Reveal><span className="eyebrow">كيف تفكر خُطى</span></Reveal>
            <Reveal delay={80}>
              <div className="progression" style={{ marginTop: 28 }}>
                {progression.map(([num, title]) => (
                  <div className="progression-item" key={num}>
                    <span className="progression-num">{num}</span>
                    <h3>{title}</h3>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Scene 04: المراحل الأربع ---------- */}
        <section id="stages">
          <GradeGrid bands={gradeBands} showTitleLine />
        </section>

        {/* ---------- Scene 05: كيف تعمل الجلسة ---------- */}
        <EditorialSplit image="/images/khota-live-session.webp" alt="طالب في جلسة تركيز مباشرة مع معلمته عبر الإنترنت" objectPosition="42% 20%">
          <Reveal>
            <span className="eyebrow">الجلسة</span>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)" }}>جلسة حقيقية، لا فيديو مسجَّل.</h2>
            <div className="list" style={{ marginTop: 12 }}>
              {sessionSteps.map((s, i) => (
                <article key={s}>{i + 1}. {s}</article>
              ))}
            </div>
          </Reveal>
        </EditorialSplit>

        {/* ---------- Scene 06: رؤية ولي الأمر — كشف طبقي، لا Split تقليدي ---------- */}
        <section className="layered-reveal">
          <div className="container">
            <Reveal>
              <div className="layered-reveal-text">
                <span className="eyebrow">ولي الأمر</span>
                <h2 style={{ fontSize: "clamp(28px,3.6vw,44px)" }}>
                  وأنت تعرف كيف يتقدّم.
                </h2>
                <div className="list" style={{ marginTop: 16 }}>
                  <article>ما أنجزه</article>
                  <article>ما يحتاج متابعة</article>
                  <article>الجلسة القادمة</article>
                  <article>تقدّمه خلال الأسبوع</article>
                </div>
                <Link className="btn outline" href="/parent">شاهد لوحة ولي الأمر ←</Link>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="layered-reveal-photo-wrap">
                <div className="layered-reveal-photo">
                  <Image
                    src="/images/khota-progress.webp"
                    alt="ولي أمر يتابع تقدّم ابنه من المنزل"
                    fill
                    sizes="(max-width: 850px) 84vw, 520px"
                    style={{ objectFit: "cover", objectPosition: "32% 30%" }}
                    loading="lazy"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Scene 07: المعلمون — لحظة سينمائية هادئة، مقياس مختلف جذريًا ---------- */}
        <section className="quiet-cinematic">
          <div className="bg">
            <Image
              src="/images/khota-teacher.webp"
              alt="معلمة سعودية تقدّم جلسة تعليمية عن بُعد"
              fill
              sizes="100vw"
              style={{ objectFit: "cover", objectPosition: "45% 20%" }}
              loading="lazy"
            />
          </div>
          <div className="container quiet-cinematic-content">
            <Reveal>
              <span className="eyebrow">المعلمون</span>
              <h2>متابعة بشرية، بطريقة منظمة — لا شرح للدرس من جديد.</h2>
              <Link className="btn outline" style={{ marginTop: 20, borderColor: "#ffffff55", color: "#fff" }} href="/teachers">
                تعرّف على طريقة المتابعة ←
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ---------- Scene 08: الخطط ---------- */}
        <section className="section">
          <div className="container">
            <Reveal>
              <div className="section-head">
                <span className="eyebrow">الخطط</span>
                <h2>ثلاث خطط، بحسب ما يناسبكم.</h2>
              </div>
            </Reveal>
            <div className="stage-card-grid stage-card-grid-3">
              {[
                ["الانطلاقة", "يومان في الأسبوع", "8 جلسات شهريًا", "399"],
                ["الأساسية", "3 أيام في الأسبوع", "12 جلسة شهريًا", "529"],
                ["المكثفة", "4 أيام في الأسبوع", "16 جلسة شهريًا", "679"],
              ].map(([name, days, sessions, price], i) => (
                <Reveal delay={i * 80} key={name}>
                  <Link href="/motabaa/plans" className="stage-card" style={{ padding: 26, display: "block" }}>
                    <b style={{ fontSize: 19 }}>{name}</b>
                    <p style={{ color: "var(--gray)", margin: "8px 0 0", fontSize: 14 }}>{days}</p>
                    <p style={{ color: "var(--gray)", margin: "2px 0 0", fontSize: 14 }}>{sessions}</p>
                    <p style={{ fontSize: 24, fontWeight: 800, color: "var(--n)", marginTop: 14 }}>{price} <small style={{ fontSize: 13, fontWeight: 700, color: "var(--gray)" }}>ر.س شهريًا</small></p>
                  </Link>
                </Reveal>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 28, justifyContent: "center" }}>
              <Link className="btn" href="/motabaa/plans">اختر خطتك ←</Link>
            </div>
          </div>
        </section>

        {/* ---------- Scene 09: الثقة والخصوصية ---------- */}
        <section className="trust-strip">
          <div className="container">
            <ul>
              <li>لا نطلب بيانات الدخول إلى المنصات المدرسية.</li>
              <li>لا نطلب كلمات مرور مدرستي أو توكلنا.</li>
              <li>بيانات الأسرة تُستخدم فقط لتقديم خدمة خُطى.</li>
            </ul>
          </div>
        </section>

        {/* ---------- Scene 10: CTA ختامي ---------- */}
        <section className="cta-cinematic">
          <div className="bg">
            <Image src="/images/khota-about.webp" alt="مكتب دراسة هادئ" fill sizes="100vw" style={{ objectFit: "cover" }} loading="lazy" />
          </div>
          <div className="container cta-cinematic-content">
            <Reveal>
              <h2>
                خطوة اليوم،
                <br />
                تصنع فرق الغد.
              </h2>
              <Link className="btn" href="/start">ابدأ مع خُطى ←</Link>
            </Reveal>
          </div>
        </section>
      </main>
    </Shell>
  );
}
