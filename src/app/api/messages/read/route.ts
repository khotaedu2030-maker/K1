import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { authorizeMessageThreadAccess } from "@/lib/messaging-authorization";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

// تحديد رسائل الطرف الآخر كمقروءة. القراءة مسموحة دائمًا لطرفَي المحادثة الأصليين حتى لو
// انتهت العلاقة التعليمية (Historical Read) — لا نتحقق من canWrite هنا عمدًا، فقط أن المستخدم
// طرف فعلي في هذه المحادثة تحديدًا.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 4 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const threadId = typeof parsed.body?.threadId === "string" ? parsed.body.threadId.trim() : "";
  if (!threadId || threadId.length > 100) return NextResponse.json({ error: "threadId مطلوب" }, { status: 400 });

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const userLimit = await checkRateLimit({ request: req, scope: "messages:read:user", identifier: user.id, limit: 60, windowSeconds: 300 });
  const userRejection = rateLimitRejectionResponse(userLimit);
  if (userRejection) return userRejection;

  const auth = await authorizeMessageThreadAccess(user.id, threadId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const threadLimit = await checkRateLimit({ request: req, scope: "messages:read:thread", identifier: threadId, limit: 30, windowSeconds: 300 });
  const threadRejection = rateLimitRejectionResponse(threadLimit);
  if (threadRejection) return threadRejection;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .neq("sender_user_id", user.id)
    .is("read_at", null);
  if (error) {
    console.error("[messages] mark-read failed:", error.message);
    return NextResponse.json({ error: "تعذّر تحديث الرسائل" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
