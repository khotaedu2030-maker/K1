import "server-only";

export function areOnlinePaymentsEnabled(): boolean {
  return process.env.KHOTA_PAYMENTS_ENABLED === "true";
}
