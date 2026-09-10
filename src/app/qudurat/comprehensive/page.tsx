import Link from "next/link";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">خُطى قدرات</span>
            <h1>البرنامج الشامل</h1>
            <p className="lead">تغطية متوازنة للقسمين الكمي واللفظي معًا ضمن معسكر واحد، لمن يرغب الاستعداد الكامل.</p>
            <Link className="btn" href="/qudurat/programs">عرض البرامج ←</Link>
          </div>
        </section>
      </main>
    </Shell>
  );
}
