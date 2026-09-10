import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isPilotAuthEnabled, verifyPilotSessionToken, PILOT_SESSION_COOKIE } from "@/lib/pilot-auth";

export type ParentContext = { parentId: string; fullName: string; isPilot: boolean };

// المرجع الوحيد لتحديد "من هو ولي الأمر الحالي" في صفحات /parent التي تدعم Pilot Mode.
// المسار الحقيقي (جلسة Supabase Auth فعلية) لم يتغيّر إطلاقًا وله الأولوية دائمًا.
// مسار Pilot لا يعمل إلا إذا: لا توجد جلسة Supabase حقيقية + isPilotAuthEnabled() + كوكي
// Pilot موقَّعة وصالحة فعليًا — وليس أي شرط منها وحده.
export async function resolveParentContext(): Promise<ParentContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: parent } = await supabase
      .from("parents")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!parent) return null;
    return { parentId: parent.id, fullName: parent.full_name, isPilot: false };
  }

  if (!isPilotAuthEnabled()) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(PILOT_SESSION_COOKIE)?.value;
  const validPilotSession = await verifyPilotSessionToken(token);
  if (!validPilotSession) return null;

  const admin = createSupabaseAdminClient();

  // أولوية أولى: كوكي وضعها /api/payment/confirm فور تفعيل اشتراك في هذا المتصفح تحديدًا —
  // ربط دقيق بالاشتراك الفعلي الذي أنشأه هذا المستخدم في رحلته، وليس تخمينًا عامًا.
  const lastSubscriptionId = cookieStore.get("khota_pilot_last_subscription")?.value;
  if (lastSubscriptionId) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("parent_id")
      .eq("id", lastSubscriptionId)
      .maybeSingle();
    if (sub?.parent_id) {
      const { data: linkedParent } = await admin
        .from("parents")
        .select("id, full_name, user_id")
        .eq("id", sub.parent_id)
        .maybeSingle();
      // نتحقق أن هذا الوالد لا يزال بلا user_id (لم يُربَط بحساب حقيقي) — حماية إضافية تمنع
      // استخدام الكوكي للوصول لحساب أصبح مرتبطًا بمستخدم حقيقي لاحقًا.
      if (linkedParent && linkedParent.user_id === null) {
        return { parentId: linkedParent.id, fullName: linkedParent.full_name, isPilot: true };
      }
    }
  }

  // احتياطي فقط عند غياب الكوكي أعلاه (مثلًا جلسة Pilot قديمة بلا كوكي اشتراك مرتبط):
  // آلية آمنة ومحدودة — أحدث سجل "ولي أمر" أُنشئ عبر تسجيل ضيف (بلا user_id)، وليس اختيارًا
  // عشوائيًا لأي عميل حقيقي.
  const { data: pilotParent } = await admin
    .from("parents")
    .select("id, full_name")
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pilotParent) return null;
  return { parentId: pilotParent.id, fullName: pilotParent.full_name, isPilot: true };
}
