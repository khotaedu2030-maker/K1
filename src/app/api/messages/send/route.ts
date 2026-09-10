import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { authorizeMessageThreadAccess, THREAD_CLOSED_MESSAGE } from "@/lib/messaging-authorization";
import { isQuietHoursNow, QUIET_HOURS_MESSAGE } from "@/lib/messaging-config";

// إرسال رسالة. لا يكفي أن تكون طرفًا أصليًا في المحادثة — authorizeMessageThreadAccess يعيد
// التحقق من العلاقة الحالية فعليًا (ما زال ولي الأمر مالكًا للطفل / ما زال المعلم يدرّسه ضمن
// اشتراك فعّال) في كل مرة، لا فقط عند إنشاء المحادثة.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const threadId = body?.threadId as string | undefined;
  const rawBody = body?.body as string | undefined;

  if (!threadId) return NextResponse.json({ error: "threadId مطلوب" }, { status: 400 });
  const text = (rawBody ?? "").trim();
  if (!text) return NextResponse.json({ error: "لا يمكن إرسال رسالة فارغة" }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "الرسالة طويلة جدًا" }, { status: 400 });

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const auth = await authorizeMessageThreadAccess(user.id, threadId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.canWrite) return NextResponse.json({ error: THREAD_CLOSED_MESSAGE }, { status: 409 });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("messages").insert({
    thread_id: threadId,
    sender_user_id: user.id,
    sender_role: auth.role,
    body: text,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("message_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

  const quiet = isQuietHoursNow();
  return NextResponse.json({ ok: true, quietHours: quiet, quietHoursMessage: quiet ? QUIET_HOURS_MESSAGE : null });
}
