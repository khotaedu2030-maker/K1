import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveParentIdentityForUser } from "@/lib/require-parent";
import { getRuntimeSettings } from "@/lib/platform-settings";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

// طلب تجميد اشتراك — Workflow بحالة صريحة (requested → approved/rejected)، وليس تعديلًا مباشرًا
// لولي الأمر على الاشتراك. كل قواعد الأهلية من src/lib/policies.ts فقط.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 8 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const subscriptionId = typeof body?.subscriptionId === "string" ? body.subscriptionId.trim() : "";
  const startDate = typeof body?.startDate === "string" ? body.startDate.trim() : "";
  const endDate = typeof body?.endDate === "string" ? body.endDate.trim() : "";
  const rawReason = body?.reason as string | undefined;
  const reason = typeof rawReason === "string" ? rawReason.trim() : undefined;

  if (!subscriptionId || subscriptionId.length > 100 || !startDate || !endDate) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (reason !== undefined && reason.length > 1000) {
    return NextResponse.json({ error: "سبب التجميد طويل جدًا" }, { status: 400 });
  }

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const userLimit = await checkRateLimit({ request: req, scope: "subscription-pause:request:user", identifier: user.id, limit: 5, windowSeconds: 3600 });
  const userRejection = rateLimitRejectionResponse(userLimit);
  if (userRejection) return userRejection;

  const admin = createSupabaseAdminClient();

  const parentIdentity = await resolveParentIdentityForUser(user.id);
  if (!parentIdentity.ok) return NextResponse.json({ error: parentIdentity.error }, { status: parentIdentity.status });
  const parent = { id: parentIdentity.parentId };

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, parent_id, status")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!subscription || subscription.parent_id !== parent.id) {
    return NextResponse.json({ error: "هذا الاشتراك لا يخصك" }, { status: 403 });
  }

  const subscriptionLimit = await checkRateLimit({ request: req, scope: "subscription-pause:request:subscription", identifier: subscriptionId, limit: 3, windowSeconds: 3600 });
  const subscriptionRejection = rateLimitRejectionResponse(subscriptionLimit);
  if (subscriptionRejection) return subscriptionRejection;

  if (subscription.status !== "active") {
    return NextResponse.json({ error: "لا يمكن تجميد اشتراك غير فعّال" }, { status: 409 });
  }

  const parseDateOnly = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  };

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) {
    return NextResponse.json({ error: "صيغة التاريخ غير صحيحة" }, { status: 400 });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const today = parseDateOnly(todayIso)!;
  if (start < today) {
    return NextResponse.json({ error: "لا يمكن طلب تجميد بأثر رجعي" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "تاريخ النهاية قبل تاريخ البداية" }, { status: 400 });
  }

  const durationDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const settings = await getRuntimeSettings();
  if (durationDays < settings.pauseMinDays) {
    return NextResponse.json({ error: `أقل مدة تجميد ${settings.pauseMinDays} أيام` }, { status: 400 });
  }
  if (durationDays > settings.pauseMaxDays) {
    return NextResponse.json({ error: `أقصى مدة تجميد ${settings.pauseMaxDays} أيام` }, { status: 400 });
  }

  const { data: existingPauses } = await admin
    .from("subscription_pauses")
    .select("start_date, end_date")
    .eq("subscription_id", subscriptionId)
    .in("status", ["requested", "approved", "active"]);

  const overlaps = (existingPauses ?? []).some((p: { start_date: string; end_date: string }) => {
    const pStart = new Date(p.start_date);
    const pEnd = new Date(p.end_date);
    return start <= pEnd && end >= pStart;
  });
  if (overlaps) {
    return NextResponse.json({ error: "يوجد طلب تجميد آخر متداخل مع هذه الفترة" }, { status: 409 });
  }

  const { error } = await admin.from("subscription_pauses").insert({
    subscription_id: subscriptionId,
    requested_by: user.id,
    start_date: startDate,
    end_date: endDate,
    reason: reason ?? null,
    status: "requested",
  });
  if (error) {
    console.error("[subscription-pause] request failed:", error.message);
    return NextResponse.json({ error: "تعذّر إرسال طلب التجميد" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
