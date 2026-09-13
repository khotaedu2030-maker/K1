import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">خُطى</span>
          <h1 className="title" style={{ fontSize: 36 }}>سياسة الخصوصية</h1>
          <nav aria-label="أقسام الصفحة" style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18, borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
            <a href="#data-collected" style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>البيانات التي نجمعها</a>
            <a href="#data-use" style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>كيف نستخدمها</a>
            <a href="#data-access" style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>من يصل إليها</a>
            <a href="#rights" style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>حقوقك</a>
          </nav>
          <div className="list" style={{ marginTop: 24 }}>
            <article id="data-collected">
              <b>البيانات التي نجمعها</b>
              <p style={{ color: "var(--gray)", marginTop: 6 }}>
                اسم ولي الأمر ورقم جواله، واسم الطفل وصفّه الدراسي — فقط ما يلزم لتفعيل المتابعة
                التعليمية وربط ولي الأمر بحساب طفله.
              </p>
            </article>
            <article id="data-use">
              <b>كيف نستخدمها</b>
              <p style={{ color: "var(--gray)", marginTop: 6 }}>
                لتشغيل الحساب، جدولة الجلسات، إرسال بطاقات الإنجاز، وربط ولي الأمر ببيانات طفله. وعند تفعيل الدخول بالجوال قد يُستخدم رقم الجوال لإرسال رمز تحقق. لا نستخدم البيانات لأغراض تسويقية خارجية.
              </p>
            </article>
            <article id="data-access">
              <b>من يصل إلى البيانات</b>
              <p style={{ color: "var(--gray)", marginTop: 6 }}>
                فريق خُطى والمعلم المسؤول عن مجموعة طفلك فقط — لا نشارك بياناتك مع أي طرف ثالث
                لأغراض تسويقية.
              </p>
            </article>
            <article id="rights">
              <b>حقوقك</b>
              <p style={{ color: "var(--gray)", marginTop: 6 }}>
                يمكنك طلب مراجعة أو حذف بيانات حسابك في أي وقت عبر التواصل معنا.
              </p>
            </article>
          </div>
        </div>
      </main>
    </Shell>
  );
}
