"use client";

import { useRouter } from "next/navigation";

// يظهر فقط عند context.isPilot === true من الصفحة الأب — يمسح كوكي Pilot فقط،
// ولا يلمس جلسة Supabase Auth الحقيقية بأي شكل.
export default function PilotLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/pilot-auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="btn small outline" onClick={logout} style={{ marginInlineStart: 10 }}>
      خروج من الوضع التجريبي
    </button>
  );
}
