import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type TeacherCheckResult =
  | { ok: true; userId: string; teacherId: string }
  | { ok: false; response: NextResponse };

export async function getTeacherIdentity(): Promise<{ userId: string; teacherId: string } | null> {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data: teacher } = await admin
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  return teacher ? { userId: user.id, teacherId: teacher.id } : null;
}

export async function requireTeacher(): Promise<TeacherCheckResult> {
  const identity = await getTeacherIdentity();
  if (!identity) {
    return { ok: false, response: NextResponse.json({ error: "هذا الحساب ليس حساب معلم نشط" }, { status: 403 }) };
  }
  return { ok: true, ...identity };
}