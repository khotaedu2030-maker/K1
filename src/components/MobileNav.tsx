"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NAV_LINKS } from "./nav-links";
import type { AuthState } from "./Header";

export default function MobileNav({
  auth,
  loggingOut,
  onLogout,
}: {
  auth: AuthState;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // قفل تمرير الصفحة خلف الـDrawer + إعادة التركيز لزر القائمة عند الإغلاق (كيبورد)
  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="mobile-nav">
      <button
        ref={buttonRef}
        className="hamburger"
        aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {/* الـDrawer يبقى في DOM دائمًا (لا يُحذَف/يُعاد إنشاؤه) — هذا ما يسمح بحركة دخول/خروج
          سلسة عبر transition حقيقي بدل ظهور/اختفاء فوري، مع احترام prefers-reduced-motion
          تلقائيًا عبر القاعدة العامة أعلى الملف. */}
      <div className={`mobile-nav-backdrop${open ? " open" : ""}`} onClick={close} aria-hidden={!open} />
      <div
        className={`mobile-nav-panel${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <nav>
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href} onClick={close}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="mobile-nav-actions">
          {auth.status === "authenticated" && (
            <>
              {auth.dashboardHref && (
                <Link href={auth.dashboardHref} className="btn outline" onClick={close}>
                  لوحة الحساب
                </Link>
              )}
              <button
                type="button"
                className="btn"
                disabled={loggingOut}
                onClick={() => {
                  close();
                  onLogout();
                }}
              >
                {loggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}
              </button>
            </>
          )}
          {auth.status === "guest" && (
            <>
              <Link href="/login" className="btn outline" onClick={close}>
                تسجيل الدخول
              </Link>
              <Link href="/start" className="btn" onClick={close}>
                ابدأ مع خُطى
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
