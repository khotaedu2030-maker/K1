import "server-only";

export function areUnfinishedRoutesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.KHOTA_ENABLE_UNFINISHED_ROUTES === "true";
}
