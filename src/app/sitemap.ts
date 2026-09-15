import type { MetadataRoute } from "next";

// صفحات عامة تسويقية فقط — لا مسارات محمية (parent/teacher/admin/student)، ولا API، ولا مسارات
// قديمة مخفية عمدًا من رحلة KHOTA الحالية (English/قدرات).
const PRODUCTION_DOMAIN = "https://khota.sa";

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
  "/refund-policy",
  "/complaints",
  "/legal",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${PRODUCTION_DOMAIN}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
