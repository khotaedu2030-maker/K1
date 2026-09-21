import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// يحدّد دور المستخدم المصادَق فعليًا بعد OTP — لا يُربَط Teacher أو Admin تلقائيًا كـParent.
// لا يكشف أي بيانات حساسة، فقط الدور نفسه.
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ role: "none" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { data: adminRow } = await admin.from("admins").select("id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (adminRow) return NextResponse.json({ role: "admin" });

  const { data: teacherRow } = await admin.from("teachers").select("id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (teacherRow) return NextResponse.json({ role: "teacher" });

  const { data: parentRow } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (parentRow) return NextResponse.json({ role: "parent" });

  return NextResponse.json({ role: "none" });
}
