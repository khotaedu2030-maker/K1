import { NextResponse } from "next/server";
import { isPilotAuthEnabled } from "@/lib/pilot-auth";

// نقطة اكتشاف فقط (Feature Flag) — لا تمنح أي صلاحية بذاتها، فقط تخبر واجهة /login هل تعرض
// قسم "الدخول التجريبي" أم لا. في الإنتاج تُرجع 404 مثل بقية مسارات Pilot، لا {enabled:false}،
// حتى لا يظهر أي أثر لوجود هذه الميزة أصلًا خارج بيئة التطوير.
export async function GET() {
  if (!isPilotAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ enabled: true });
}
