import Link from "next/link";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">خُطى قدرات</span>
            <h1>القسم اللفظي</h1>
            <p className="lead">التناظر اللفظي، إكمال الجمل، الخطأ السياقي، والاستيعاب المقروء — بأمثلة مكثفة ومراجعة دورية.</p>
            <Link className="btn" href="/qudurat/programs">عرض البرامج ←</Link>
          </div>
        </section>
      </main>
    </Shell>
  );
}
