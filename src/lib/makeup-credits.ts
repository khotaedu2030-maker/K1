import "server-only";
import { ABSENCE_POLICY, isAbsenceReasonCreditEligible, isMonthlyCapApplicable, type AttendanceReason, type CreditSourceType } from "@/lib/policies";
import { getRuntimeSettings } from "@/lib/platform-settings";

// نقطة الإصدار المركزية الوحيدة لأي رصيد تعويضي في النظام — سواء من غياب طالب فردي (عبر تقرير
// المعلم) أو إلغاء جلسة كاملة (معلم/منصة). كل الاستدعاءات الأخرى تمر من هنا، لا تُكرَّر منطق
// الأهلية أو السقف الشهري في أكثر من مكان.
export async function issueMakeupCreditIfEligible(
  admin: any,
  params: {
    childId: string;
    subscriptionId?: string | null;
    sourceSessionId: string;
    sourceType: CreditSourceType;
    reason?: AttendanceReason | null;
    issuedBy?: string | null;
  }
): Promise<{ issued: boolean; skippedReason?: "not_eligible" | "monthly_cap_reached" }> {
  const { childId, subscriptionId, sourceSessionId, sourceType, reason, issuedBy } = params;

  if (sourceType === "student_absence") {
    if (!reason || !isAbsenceReasonCreditEligible(reason)) {
      return { issued: false, skippedReason: "not_eligible" };
    }
  }

  if (isMonthlyCapApplicable(sourceType)) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await admin
      .from("makeup_credits")
      .select("*", { count: "exact", head: true })
      .eq("child_id", childId)
      .eq("source_type", "student_absence")
      .gte("issued_at", startOfMonth.toISOString());

    // السقف الشهري الفعلي: platform_settings.makeup_monthly_limit إن كانت الهجرة مُطبَّقة،
    // وإلا القيمة الافتراضية المطابقة لـABSENCE_POLICY.MONTHLY_STUDENT_CAUSED_MAKEUP_LIMIT.
    const settings = await getRuntimeSettings();
    if ((count ?? 0) >= settings.makeupMonthlyLimit) {
      return { issued: false, skippedReason: "monthly_cap_reached" };
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ABSENCE_POLICY.MAKEUP_CREDIT_VALIDITY_DAYS);

  // ignoreDuplicates + قيد unique(source_session_id, child_id) في قاعدة البيانات = حماية مزدوجة
  // ضد إصدار رصيدين لنفس الغياب، حتى لو استُدعيت هذه الدالة أكثر من مرة لنفس الحدث.
  await admin.from("makeup_credits").upsert(
    {
      child_id: childId,
      subscription_id: subscriptionId ?? null,
      source_session_id: sourceSessionId,
      source_type: sourceType,
      reason: reason ?? null,
      status: "available",
      issued_by: issuedBy ?? null,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "source_session_id,child_id", ignoreDuplicates: true }
  );

  return { issued: true };
}
