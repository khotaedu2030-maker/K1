import "server-only";

// مسارات غير جاهزة (English/قدرات): تُعاد 404 في أي بيئة production ما لم تُفتح صراحة.
export function areUnfinishedRoutesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.KHOTA_ENABLE_UNFINISHED_ROUTES === "true";
}
