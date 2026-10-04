"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "./Logo";
import MobileNav from "./MobileNav";
import { NAV_LINKS } from "./nav-links";
import { supabase } from "@/lib/supabase";

type DashboardRole = "admin" | "teacher" | "parent";

const ROLE_DASHBOARD_PATH: Record<DashboardRole, string> = {
  admin: "/admin",
  teacher: "/teacher",
  parent: "/parent",
};

export type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "authenticated"; dashboardHref: string | null };

// transparent=true (يُمرَّر من الصفحات ذات Hero تصويري كبير فقط): الهيدر شفاف فوق الصورة حتى
// بداية التمرير، ثم يتحوّل لهيدر صلب هادئ. القيمة الافتراضية false تبقي الهيدر صلبًا دائمًا
// لبقية الصفحات، بلا أي تغيير.
export default function Header({ transparent = false }: { transparent?: boolean }) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const threshold = transparent ? 60 : 8;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  useEffect(() => {
    let active = true;
    let latestCheck = 0;
    let refreshTimer: number | null = null;

    async function resolveAuthState() {
      const checkId = ++latestCheck;
      const { data, error } = await supabase.auth.getSession();
      if (!active || checkId !== latestCheck) return;
      if (error) return;
      if (!data.session) {
        setAuth({ status: "guest" });
        return;
      }

      setAuth({ status: "authenticated", dashboardHref: null });
      const roleRes = await fetch("/api/auth/resolve-role", { method: "POST" }).catch(() => null);
      if (!active || checkId !== latestCheck) return;
      if (roleRes?.status === 401) {
        setAuth({ status: "guest" });
        return;
      }
      if (!roleRes?.ok) return;

      const roleData = await roleRes.json().catch(() => null);
      if (!active || checkId !== latestCheck) return;
      const role = roleData?.role as DashboardRole | "none" | undefined;
      if (!role || !["admin", "teacher", "parent", "none"].includes(role)) return;
      const dashboardHref = role === "none" ? null : ROLE_DASHBOARD_PATH[role];
      setAuth({ status: "authenticated", dashboardHref });
    }

    function scheduleAuthCheck() {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void resolveAuthState(), 0);
    }

    scheduleAuthCheck();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        latestCheck++;
        setAuth({ status: "guest" });
        return;
      }
      if (event === "SIGNED_IN") setAuth({ status: "loading" });
      // لا تستدعِ أي Supabase Auth API داخل callback نفسه؛ تأجيل القراءة يتجنب انتظار auth lock.
      scheduleAuthCheck();
    });
    return () => {
      active = false;
      latestCheck++;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return;
      router.replace("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

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
          {auth.status === "authenticated" && (
            <>
              {auth.dashboardHref && <Link className="btn small" href={auth.dashboardHref}>لوحة الحساب</Link>}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                style={{ background: "none", border: "none", padding: 0, font: "inherit", color: transparent && !scrolled ? "#fff" : "var(--n)", cursor: "pointer" }}
              >
                {loggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}
              </button>
            </>
          )}
          {auth.status === "guest" && (
            <>
              <Link href="/login">تسجيل الدخول</Link>
              <Link className="btn small" href="/start">ابدأ مع خُطى</Link>
            </>
          )}
        </div>
        <MobileNav auth={auth} loggingOut={loggingOut} onLogout={handleLogout} />
      </div>
    </header>
  );
}
