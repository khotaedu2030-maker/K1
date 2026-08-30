import type { Metadata } from "next";
import { Cairo, Poppins } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "خُطى | KHOTA",
  description:
    "خُطى — خطوة. بثقة. نحو التميز. برامج وخدمات تعليمية تساعد الطلاب على بناء مهارات التعلم والنجاح الأكاديمي.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} ${poppins.variable}`}>
        {children}
      </body>
    </html>
  );
}