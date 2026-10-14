const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type RequestSecurityResult =
  | { ok: true }
  | { ok: false; reason: "cross_site" | "origin_mismatch" };

/**
 * Browser CSRF guard for cookie-authenticated API routes.
 *
 * - Fetch Metadata gives us a strong browser signal for cross-site requests.
 * - Origin is checked when present.
 * - Requests without browser headers are not rejected here so trusted server-to-server
 *   integrations and operational scripts remain possible; sensitive routes must still
 *   perform their normal authentication/authorization checks.
 */
export function validateUnsafeRequestOrigin(request: Request): RequestSecurityResult {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return { ok: true };

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return { ok: false, reason: "cross_site" };

  const origin = request.headers.get("origin");
  if (!origin) return { ok: true };

  try {
    const requestOrigin = new URL(request.url).origin;
    if (new URL(origin).origin !== requestOrigin) {
      return { ok: false, reason: "origin_mismatch" };
    }
  } catch {
    return { ok: false, reason: "origin_mismatch" };
  }

  return { ok: true };
}
