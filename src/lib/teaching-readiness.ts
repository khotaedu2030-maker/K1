// Pure, server-compatible operational readiness assessment.
// This is a UX preflight only. The authoritative final checks run inside
// activate_pilot_trial_atomic under a transaction and cannot be bypassed.
export type CohortForTeaching = {
  id: string;
  title: string;
  status: string | null;
  capacity: number | null;
  teacher_id: string | null;
  meeting_url: string | null;
  plan_id: string | null;
  product: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
};
export type TeacherForTeaching = {
  id: string;
  active: boolean | null;
  user_id: string | null;
  verifiedLogin: boolean;
};
export type PlanForTeaching = {
  id: string;
  active: boolean | null;
  product: string | null;
  days_per_week: number | null;
};

export function isTeamsMeetingUrl(raw: string | null | undefined): boolean {
  if (!raw || !raw.startsWith("https://")) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:"
      && (url.hostname === "teams.microsoft.com" || url.hostname === "teams.live.com")
      && url.username === "" && url.password === ""
      && url.pathname.length > 1;
  } catch {
    return false;
  }
}
export function teachingReadinessIssues(
  cohort: CohortForTeaching | null,
  teacher: TeacherForTeaching | null,
  plan: PlanForTeaching | null,
): string[] {
  if (!cohort) return ["لم تُحدَّد مجموعة تعليمية."];

  const issues: string[] = [];
  if (cohort.status !== "open") issues.push("المجموعة غير متاحة للتسجيل.");
  if (!cohort.teacher_id) issues.push("لم يُسنَد معلم للمجموعة.");
  else if (!teacher || teacher.id !== cohort.teacher_id || !teacher.active)
    issues.push("المعلم المسند غير نشط أو غير موجود.");
  else if (!teacher.user_id) issues.push("المعلم لم يُجهَّز له حساب دخول مستقل.");
  else if (!teacher.verifiedLogin) issues.push("بريد دخول المعلم لم يُوثّق بعد.");

  if (!isTeamsMeetingUrl(cohort.meeting_url))
    issues.push("رابط اجتماع Microsoft Teams مفقود أو غير صالح.");

  if (!plan || !plan.active || plan.product !== "motabaa"
      || cohort.product !== "motabaa" || cohort.plan_id !== plan.id)
    issues.push("الخطة التعليمية غير نشطة أو لا تطابق المجموعة.");
  else if (!cohort.days_of_week || plan.days_per_week !== cohort.days_of_week.length
      || new Set(cohort.days_of_week).size !== cohort.days_of_week.length)
    issues.push("عدد أيام المجموعة لا يطابق الباقة.");

  if (!cohort.start_time || !cohort.end_time || cohort.start_time >= cohort.end_time)
    issues.push("توقيت جلسات المجموعة غير مكتمل.");
  return issues;
}
