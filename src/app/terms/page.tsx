import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">خُطى</span>
          <h1 className="title" style={{ fontSize: 36 }}>الشروط والأحكام</h1>
          <nav aria-label="أقسام الصفحة" style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18, borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
            <a href="#nature" style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>طبيعة الخدمة</a>
            <a href="#billing" style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>الاشتراك والدفع</a>
            <a href="#attendance" style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>الحضور والتعويض</a>
            <a href="#cancel" style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>إنهاء الاشتراك</a>
          </nav>
          <div className="list" style={{ marginTop: 24 }}>
            <article id="nature">
              <b>طبيعة الخدمة</b>
              <p style={{ color: "var(--gray)", marginTop: 6 }}>
                خُطى منصة متابعة تعليمية بعد المدرسة — نساعد الطالب على تنظيم مهامه وإنجازها
                بنفسه، ولا نقدّم حلول واجبات أو شرحًا أكاديميًا كاملًا بديلًا عن المدرسة.
              </p>
            </article>
            <article id="billing">
              <b>الاشتراك والدفع</b>
              <p style={{ color: "var(--gray)", marginTop: 6 }}>
                الاشتراك شهري بحسب الخطة المختارة عند التسجيل، ويُفعَّل بعد تأكيد الدفع. وتُعرض آلية التجديد أو الإلغاء بوضوح عند تفعيل وسيلة الدفع المعتمدة.
              </p>
            </article>
            <article id="attendance">
              <b>الحضور والتعويض</b>
              <p style={{ color: "var(--gray)", marginTop: 6 }}>
                الغياب المبرَّر أو الإلغاء من طرف خُطى قد يمنح رصيد تعويض حسب سياسة المنصة —
                الغياب غير المبرَّر لا يمنح تعويضًا تلقائيًا.
              </p>
            </article>
            <article id="cancel">
              <b>إنهاء الاشتراك</b>
              <p style={{ color: "var(--gray)", marginTop: 6 }}>
                يمكن لولي الأمر طلب إيقاف الاشتراك في أي وقت عبر التواصل معنا.
              </p>
            </article>
          </div>
        </div>
      </main>
    </Shell>
  );
}
