import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SYNTHETIC_ID = "00000000-0000-4000-8000-000000000000";
const QUERY_COUNT = 7;

function response(ok: boolean, durationMs: number, status: number) {
  return NextResponse.json(
    { ok, queryCount: ok ? QUERY_COUNT : 0, durationMs },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function GET(req: Request) {
  const startedAt = performance.now();
  const duration = () => Math.round(performance.now() - startedAt);

  if (process.env.VERCEL_ENV !== "preview") return response(false, duration(), 404);

  const configuredKey = process.env.KHOTA_LOAD_TEST_KEY;
  const suppliedKey = req.headers.get("x-khota-load-test-key");
  if (!configuredKey || !suppliedKey || suppliedKey !== configuredKey) return response(false, duration(), 401);

  const admin = createSupabaseAdminClient();
  const { error: parentError } = await admin
    .from("parents")
    .select("id")
    .eq("id", SYNTHETIC_ID)
    .maybeSingle();
  if (parentError) return response(false, duration(), 503);

  const { error: childrenError } = await admin
    .from("children")
    .select("id, first_name")
    .eq("parent_id", SYNTHETIC_ID);
  if (childrenError) return response(false, duration(), 503);

  const [tasksResult, recommendationResult, pulseResult, weeklyGoalResult, independenceResult] = await Promise.all([
    admin.from("daily_tasks").select("title,status").eq("child_id", SYNTHETIC_ID).limit(5),
    admin.from("recommendations").select("reason").eq("child_id", SYNTHETIC_ID).limit(1).maybeSingle(),
    admin.from("daily_pulse_reports").select("created_at").eq("child_id", SYNTHETIC_ID).limit(1).maybeSingle(),
    admin.from("weekly_goals").select("title,status,progress").eq("child_id", SYNTHETIC_ID).limit(1).maybeSingle(),
    admin.from("independence_assessments").select("total_score").eq("child_id", SYNTHETIC_ID).limit(1).maybeSingle(),
  ]);
  if ([tasksResult, recommendationResult, pulseResult, weeklyGoalResult, independenceResult].some((result) => result.error)) {
    return response(false, duration(), 503);
  }

  return response(true, duration(), 200);
}