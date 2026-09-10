import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { STUDENT_SESSION_COOKIE, isStudentModeAllowedApiPath } from "@/lib/student-mode-constants";
import { isPilotAuthEnabled, verifyPilotSessionToken, PILOT_SESSION_COOKIE } from "@/lib/pilot-auth";

// حارس صلاحيات على مستوى الـ Routes نفسها — قبل أن تصل الصفحة أو الـ API لأي كود تنفيذ.
// هذا مكمّل للتحقق الدقيق (الدور الصحيح، ملكية البيانات) الذي يبقى داخل كل صفحة/route عبر
// استعلام قاعدة البيانات — لكنه يمنع الوصول غير المصرَّح به من الأساس، بصرف النظر عمّا تعرضه الواجهة.
const AUTH_REQUIRED_PREFIXES = ["/parent", "/teacher", "/admin", "/student"];
const PARENT_AREA_PREFIXES = ["/parent", "/teacher", "/admin"];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const studentCookieId = request.cookies.get(STUDENT_SESSION_COOKIE)?.value;
  const isProtectedPage = AUTH_REQUIRED_PREFIXES.some((p) => path.startsWith(p));
  const isApiPath = path.startsWith("/api/");

  // لا حاجة لأي عمل إضافي إن لم تكن هذه صفحة محمية، ولا API، ولا يوجد كوكي Student Mode إطلاقًا —
  // هذا يغطي الغالبية العظمى من حركة الموقع العام بلا أي تكلفة إضافية (لا استدعاء Supabase).
  if (!isProtectedPage && !isApiPath && !studentCookieId) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ---------- التحقق الفعلي من صلاحية جلسة Student Mode (وليس فقط وجود الكوكي) ----------
  let studentModeActive = false;
  if (studentCookieId && user) {
    const { data: sms } = await supabase
      .from("student_mode_sessions")
      .select("active, expires_at, parent_user_id")
      .eq("id", studentCookieId)
      .maybeSingle();

    studentModeActive = Boolean(
      sms && sms.active && sms.parent_user_id === user.id && new Date(sms.expires_at).getTime() > Date.now()
    );
  }

  // كوكي موجودة لكنها غير صالحة (منتهية/معطَّلة/لا تخص هذا المستخدم) — نمسحها فورًا حتى لا تحبس
  // ولي الأمر خارج /parent إلى الأبد بسبب جلسة طالب قديمة.
  if (studentCookieId && !studentModeActive) {
    response.cookies.set(STUDENT_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  }

  if (studentModeActive) {
    // منع الوصول لمسارات ولي الأمر/المعلم/الأدمن حتى عبر كتابة الرابط يدويًا
    if (PARENT_AREA_PREFIXES.some((p) => path.startsWith(p))) {
      return NextResponse.redirect(new URL("/student/today", request.url));
    }
    // Guard صريح وقابل لإعادة الاستخدام: أي API غير مُدرجة بوضوح في allowlist تُرفض هنا مباشرة
    if (isApiPath && !isStudentModeAllowedApiPath(path)) {
      return NextResponse.json({ error: "غير مسموح في وضع الطالب" }, { status: 403 });
    }
  }

  if (!isProtectedPage) return response;

  if (!user) {
    // Pilot Auth bypass — محصور بالكامل بمسارات /parent (نطاق اختبار رحلة العميل المطلوب)،
    // ولا يعمل إطلاقًا إلا إذا isPilotAuthEnabled() (NODE_ENV != production + KHOTA_PILOT_AUTH=true)
    // وكانت كوكي Pilot موقَّعة وصالحة فعليًا — وليس bypass عام لكل الموقع.
    if (isPilotAuthEnabled() && path.startsWith("/parent")) {
      const pilotToken = request.cookies.get(PILOT_SESSION_COOKIE)?.value;
      const pilotValid = await verifyPilotSessionToken(pilotToken);
      if (pilotValid) return response;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/parent/:path*", "/teacher/:path*", "/admin/:path*", "/student/:path*", "/api/:path*"],
};
