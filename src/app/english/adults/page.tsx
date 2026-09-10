import Link from "next/link";
import Shell from "@/components/Shell";

const tracks = [
  ["General English", "الإنجليزية العامة لمواقف الحياة اليومية والدراسة."],
  ["Conversation", "بناء الثقة والطلاقة في المحادثة."],
  ["Business English", "لغة العمل والاجتماعات والمراسلات."],
];

export default function P() {
  return (
    <Shell>
      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">English للبالغين</span>
            <h1 className="en" style={{ direction: "ltr", textAlign: "right" }}>
              General. Conversation. Business.
            </h1>
            <p className="lead">برامج جماعية للبالغين والمهنيين — Group First، والفردي Premium حسب الطلب.</p>
            <Link className="btn" href="/english/level-test">اعرف مستواك ←</Link>
          </div>
        </section>
        <section className="section">
          <div className="container">
            <div className="cards">
              {tracks.map((t) => (
                <article className="card" key={t[0]}>
                  <h3 className="en">{t[0]}</h3>
                  <p>{t[1]}</p>
                </article>
              ))}
            </div>
            <div className="summary">
              <strong>تبحث عن برنامج خاص يناسب جدولك وهدفك؟</strong>
              <Link className="btn" href="/english/private">اطلب تدريبًا فرديًا ←</Link>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}
