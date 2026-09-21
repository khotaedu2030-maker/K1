"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminAccountMenu({ adminName }: { adminName: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    void fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/staff/login");
      router.refresh();
    }
  }

  return (
    <div className="admin-account-menu">
      <span className="admin-os-admin-name">{adminName}</span>
      <button type="button" onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}
      </button>
    </div>
  );
}