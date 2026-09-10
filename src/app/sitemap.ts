import type { MetadataRoute } from "next";

// صفحات عامة تسويقية فقط — لا مسارات محمية (parent/teacher/admin/student)، ولا API، ولا مسارات
// قديمة مخفية عمدًا من رحلة KHOTA الحالية (English/قدرات). لا نطاق إنتاج معروف بعد، فالمسارات
// نسبية — Next.js يحوّلها تلقائيًا حسب النطاق الفعلي وقت التشغيل.
const PUBLIC_ROUTES = [
  "/",
  "/start",
  "/motabaa",
  "/motabaa/how-it-works",
  "/motabaa/plans",
  "/motabaa/stages",
  "/about",
  "/help",
  "/contact",
  "/teachers",
  "/teach-with-khota",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: route,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
