"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import MobileNav from "./MobileNav";
import { NAV_LINKS } from "./nav-links";

// transparent=true (يُمرَّر من الصفحات ذات Hero تصويري كبير فقط): الهيدر شفاف فوق الصورة حتى
// بداية التمرير، ثم يتحوّل لهيدر صلب هادئ. القيمة الافتراضية false تبقي الهيدر صلبًا دائمًا
// لبقية الصفحات، بلا أي تغيير.
export default function Header({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const threshold = transparent ? 60 : 8;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  const classes = [transparent ? "transparent" : "", scrolled ? "scrolled" : ""].filter(Boolean).join(" ");

  return (
    <header className={classes}>
      <div className="container nav">
        <Link href="/">
          <Logo />
        </Link>
        <nav>
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
        <div className="navact">
          <Link href="/login">تسجيل الدخول</Link>
          <Link className="btn small" href="/start">ابدأ مع خُطى</Link>
        </div>
        <MobileNav />
      </div>
    </header>
  );
}
