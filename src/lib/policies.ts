import "server-only";

// محرك السياسات المركزي لخُطى — أي رقم/قاعدة تشغيلية تُقرأ من هنا فقط، لا تُكرَّر داخل ملفات
// متفرقة. تعديل سياسة تشغيلية = تعديل سطر واحد هنا، وليس بحثًا عبر المشروع.

export const ABSENCE_POLICY = {
  // سقف أقصى رصيدين تعويضيين شهريًا ناتجين عن غياب الطالب نفسه فقط — لا يُطبَّق أبدًا على
  // إلغاء المعلم/خُطى (Provider-caused)، تلك مسؤولية خُطى تجاه الطالب ولا تخضع لسقف.
  MONTHLY_STUDENT_CAUSED_MAKEUP_LIMIT: 2,
  MAKEUP_CREDIT_VALIDITY_DAYS: 30,
};

export type AttendanceReason = "excused" | "unexcused" | "exceptional_approved";
export type CreditSourceType =
  | "student_absence"
  | "teacher_cancellation"
  | "platform_cancellation"
  | "manual_admin";

// الغياب غير المبرَّر لا يولّد رصيدًا تلقائيًا أبدًا — سياسة منتج صريحة، وليست تفصيلًا تقنيًا.
export function isAbsenceReasonCreditEligible(reason: AttendanceReason): boolean {
  return reason === "excused" || reason === "exceptional_approved";
}

// السقف الشهري يُطبَّق فقط على الغياب الناتج عن الطالب نفسه — إلغاء المعلم/المنصة/قرار إداري
// صريح لا يخضع له إطلاقًا، حتى لا يخسر الطالب حقه بسبب خطأ تشغيلي من خُطى.
export function isMonthlyCapApplicable(sourceType: CreditSourceType): boolean {
  return sourceType === "student_absence";
}

export const PAUSE_POLICY = {
  MAX_PAUSE_DAYS: 7,
};

export const SCORECARD_POLICY = {
  // تقرير الجلسة يُعتبر "في الوقت" إذا رُفع خلال هذا العدد من الساعات من انتهاء الجلسة
  REPORT_SLA_HOURS: 24,
};
