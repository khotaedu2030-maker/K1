import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { authorizeMessageThreadAccess } from "@/lib/messaging-authorization";

// تحديد رسائل الطرف الآخر كمقروءة. القراءة مسموحة دائمًا لطرفَي المحادثة الأصليين حتى لو
// انتهت العلاقة التعليمية (Historical Read) — لا نتحقق من canWrite هنا عمدًا، فقط أن المستخدم
// طرف فعلي في هذه المحادثة تحديدًا.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const threadId = body?.threadId as string | undefined;
  if (!threadId) return NextResponse.json({ error: "threadId مطلوب" }, { status: 400 });

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const auth = await authorizeMessageThreadAccess(user.id, threadId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .neq("sender_user_id", user.id)
    .is("read_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
