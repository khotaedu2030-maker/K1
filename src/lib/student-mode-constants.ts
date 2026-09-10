// ثوابت وأدوات آمنة للاستيراد من أي بيئة تشغيل (Edge middleware أو Node.js Server Components) —
// بلا "server-only" وبلا next/headers، حتى لا يُسحب الرسم البياني الكامل لوحدات الخادم إلى Edge.
export const STUDENT_SESSION_COOKIE = "khota_student_session";
export const STUDENT_SESSION_TTL_HOURS = 6;

// Tone مساحة الطالب أصبح مصدره الوحيد src/lib/grade-config.ts (ثلاث درجات: junior/standard/focus)
// بدل المنطق الثنائي القديم هنا (grade<=3) — استخدم getToneLevel من هناك مباشرة.
export { getToneLevel } from "@/lib/grade-config";

// Guard قابل لإعادة الاستخدام: أثناء Student Mode، أي API غير مسموحة صراحةً هنا تُرفض من
// middleware.ts نفسه قبل وصولها لأي route handler — الأمان لا يعتمد على إخفاء الروابط في الواجهة.
const STUDENT_MODE_ALLOWED_API_PREFIXES = ["/api/student/", "/api/student-mode/exit/"];

export function isStudentModeAllowedApiPath(pathname: string): boolean {
  return STUDENT_MODE_ALLOWED_API_PREFIXES.some((p) => pathname.startsWith(p));
}
