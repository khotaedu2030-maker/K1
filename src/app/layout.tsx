import type { Metadata } from "next";
import { Cairo, Poppins } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-cairo",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  // النطاق المُعطى صراحةً هذه الجولة. إن لم يكن نهائيًا بعد، عدِّل هذا السطر فقط عند التأكد.
  metadataBase: new URL("https://khota.sa"),
  alternates: { canonical: "/" },
  title: {
    default: "خُطى | KHOTA — الشريك التعليمي للأسرة بعد المدرسة",
    template: "%s | خُطى",
  },
  description:
    "خُطى تتابع طالبك بعد المدرسة، ترتّب أولوياته، تدعمه عند التعثر، وتجهّزه لليوم التالي — من الصف الأول الابتدائي حتى الثالث الثانوي.",
  keywords: ["خُطى", "KHOTA", "متابعة تعليمية", "الواجبات المدرسية", "التعليم عن بعد", "السعودية"],
  openGraph: {
    title: "خُطى | KHOTA — الشريك التعليمي للأسرة بعد المدرسة",
    description: "متابعة تعليمية منظَّمة بعد المدرسة، من الصف الأول الابتدائي حتى الثالث الثانوي.",
    locale: "ar_SA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "خُطى | KHOTA",
    description: "الشريك التعليمي للأسرة بعد المدرسة.",
  },
  // metadataBase أعلاه الآن يزوّد Open Graph/Twitter بروابط مطلقة صحيحة تلقائيًا.
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
