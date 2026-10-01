import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type RateLimitOptions = {
  request: Request;
  scope: string;
  identifier?: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  unavailable?: boolean;
};

export type LimitedJsonBodyResult =
  | { ok: true; body: Awaited<ReturnType<Request["json"]>> | null }
  | { ok: false; reason: "too_large" };

function trustedClientIp(request: Request): string {
  // Prefer the platform single-address header; accept XFF only when it contains one validated IP.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && !realIp.includes(",") && isIP(realIp)) return realIp;

  const forwarded = request.headers.get("x-forwarded-for")?.trim();
  if (forwarded && !forwarded.includes(",") && isIP(forwarded)) return forwarded;

  throw new Error("Trusted client IP unavailable");
}

function normalizeScope(scope: string): string {
  return scope.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").slice(0, 64);
}

function makeLimiterKey(scope: string, identifier: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Rate-limit key unavailable");

  const digest = createHmac("sha256", secret)
    .update(`${scope}\0${identifier.trim().toLowerCase()}`)
    .digest("hex");

  return `${scope}:${digest}`;
}

export async function checkRateLimit({
  request,
  scope,
  identifier,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const normalizedScope = normalizeScope(scope);
    if (!normalizedScope || !Number.isInteger(limit) || !Number.isInteger(windowSeconds)) {
      throw new Error("Invalid rate-limit parameters");
    }

    const limiterIdentifier = identifier?.trim() || trustedClientIp(request);
    const key = makeLimiterKey(normalizedScope, limiterIdentifier);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("consume_api_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (
      !row ||
      typeof row.allowed !== "boolean" ||
      !Number.isInteger(row.remaining) ||
      !Number.isInteger(row.retry_after_seconds)
    ) {
      throw new Error("Invalid rate-limit response");
    }

    return {
      allowed: row.allowed,
      remaining: Math.max(0, row.remaining),
      retryAfterSeconds: Math.max(1, row.retry_after_seconds),
    };
  } catch (error) {
    console.error("[api-rate-limit] Durable limiter unavailable:", error instanceof Error ? error.message : "unknown error");
    return { allowed: false, remaining: 0, retryAfterSeconds: 60, unavailable: true };
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "طلبات كثيرة جدًا. يرجى المحاولة لاحقًا." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, result.retryAfterSeconds)),
        "Cache-Control": "no-store",
      },
    }
  );
}

export function rateLimitUnavailableResponse() {
  return NextResponse.json(
    { error: "الخدمة غير متاحة مؤقتًا. يرجى المحاولة لاحقًا." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

export function rateLimitRejectionResponse(result: RateLimitResult) {
  if (result.unavailable) return rateLimitUnavailableResponse();
  return result.allowed ? null : rateLimitResponse(result);
}

export function declaredBodyExceeds(request: Request, maxBytes: number): boolean {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return false;
  if (!/^\d+$/.test(contentLength.trim())) return true;
  return Number(contentLength) > maxBytes;
}

export async function readJsonBodyLimited(request: Request, maxBytes: number): Promise<LimitedJsonBodyResult> {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive integer");
  }

  if (declaredBodyExceeds(request, maxBytes)) return { ok: false, reason: "too_large" };
  if (request.body === null) return { ok: true, body: null };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    reader = request.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          void reader.cancel().catch(() => {
            // Cancellation is best-effort; the oversized request is rejected either way.
          });
        } catch {
          // Cancellation is best-effort; the oversized request is rejected either way.
        }
        return { ok: false, reason: "too_large" };
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    try {
      const text = new TextDecoder("utf-8").decode(bytes);
      return { ok: true, body: JSON.parse(text) as Awaited<ReturnType<Request["json"]>> };
    } catch {
      return { ok: true, body: null };
    }
  } catch {
    return { ok: true, body: null };
  } finally {
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // The stream may already have released its lock.
      }
    }
  }
}
