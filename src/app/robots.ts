import type { MetadataRoute } from "next";

// لا نطاق إنتاج نهائي معروف بعد — sitemap مرتبط بمسار نسبي، يُحدَّث لمسار مطلق كامل بمجرد
// اعتماد النطاق الفعلي (production configuration).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/parent",
        "/parent/",
        "/teacher",
        "/teacher/",
        "/admin",
        "/admin/",
        "/student",
        "/student/",
        "/api/",
        "/english",
        "/english/",
        "/qudurat",
        "/qudurat/",
      ],
    },
    sitemap: "/sitemap.xml",
  };
}
