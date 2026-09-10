import Link from "next/link";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main className="placeholder-page">
        <div className="narrow">
          <span className="badge">نموذج أولي</span>
          <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>المدفوعات</h1>
          <p className="lead">هذا القسم قيد التطوير وسيتوفر في مرحلة لاحقة.</p>
          <Link className="btn outline" href="/admin">← لوحة الإدارة</Link>
        </div>
      </main>
    </Shell>
  );
}
