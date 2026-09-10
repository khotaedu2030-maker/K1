import Link from "next/link";
import Shell from "@/components/Shell";

const paths = [
  ["كمي", "التناسب، الهندسة، الجبر، وتحليل المسائل بخطة واضحة.", "/qudurat/quantitative"],
  ["لفظي", "التناظر اللفظي، إكمال الجمل، الخطأ السياقي، والاستيعاب المقروء.", "/qudurat/verbal"],
  ["شامل", "تغطية متوازنة للقسمين الكمي واللفظي معًا.", "/qudurat/comprehensive"],
];

export default function P() {
  return (
    <Shell>
      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">خُطى قدرات</span>
            <h1>استعد للقدرات بخطة، وليس بمحاولات عشوائية.</h1>
            <p className="lead">كمي، لفظي وبرامج شاملة ضمن مجموعات ومعسكرات مركزة عن بُعد.</p>
          </div>
        </section>
        <section className="section">
          <div className="container">
            <div className="cards">
              {paths.map((x) => (
                <Link className="card" href={x[2]} key={x[2]}>
                  <h3>{x[0]}</h3>
                  <p>{x[1]}</p>
                </Link>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 30 }}>
              <Link className="btn" href="/qudurat/programs">عرض البرامج ←</Link>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}
