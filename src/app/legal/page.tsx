import Link from "next/link";
import Shell from "@/components/Shell";
import { legalProfile } from "@/lib/legal-profile";

export const metadata = {
  title: "بيانات مقدّم الخدمة",
  description: "بيانات مقدّم خدمة خُطى وروابط السياسات النظامية.",
};

export default function P() {
  const rows: [string, string | null][] = [
    ["الاسم التجاري", legalProfile.brandName],
    ["اسم مقدّم الخدمة", legalProfile.providerName],
    ["نوع التسجيل", legalProfile.registrationType],
    ["رقم الوثيقة", legalProfile.registrationNumber],
    ["مقر العمل", legalProfile.businessAddress],
    ["البريد الإلكتروني للدعم", legalProfile.supportEmail],
    ["رقم التواصل", legalProfile.supportPhone],
    ["الدولة", legalProfile.country],
    ["الرقم الضريبي", legalProfile.vatNumber],
  ];
  // نعرض فقط الحقول المؤكَّدة فعليًا — لا نضع placeholder لأي قيمة غير موجودة.
  const visibleRows = rows.filter(([, value]) => value !== null && value !== "");

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">خُطى</span>
          <h1 className="title" style={{ fontSize: 36 }}>بيانات مقدّم الخدمة</h1>

          <div className="list" style={{ marginTop: 24 }}>
            {visibleRows.map(([label, value]) => (
              <article key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <b>{label}</b>
                <span style={{ color: "var(--gray)" }}>{value}</span>
              </article>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/terms" style={{ color: "var(--t)", fontWeight: 700 }}>الشروط والأحكام</Link>
            <Link href="/privacy" style={{ color: "var(--t)", fontWeight: 700 }}>سياسة الخصوصية</Link>
            <Link href="/refund-policy" style={{ color: "var(--t)", fontWeight: 700 }}>سياسة الاسترجاع والاسترداد</Link>
            <Link href="/complaints" style={{ color: "var(--t)", fontWeight: 700 }}>الشكاوى والمقترحات</Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}
