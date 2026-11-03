import { NextResponse } from "next/server";
import { declaredBodyExceeds, readJsonBodyLimited } from "@/lib/api-rate-limit";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeParentEmail } from "@/lib/parent-identity";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROVISION_MARKER = "khota_teacher_identity_provision";

function hasProvisionProof(user: { id: string; email?: string | null; app_metadata?: Record<string, unknown> }, teacherId: string, email: string) {
  return user.email?.trim().toLowerCase() === email
    && user.app_metadata?.khota_provision_marker === PROVISION_MARKER
    && user.app_metadata?.teacher_id === teacherId;
}

async function auditProvision(admin: ReturnType<typeof createSupabaseAdminClient>, adminUserId: string, teacherId: string, authUserId: string, recovered: boolean) {
  const { error } = await admin.from("admin_actions").insert({
    admin_user_id: adminUserId,
    action: recovered ? "teacher_identity_provision_recovery" : "teacher_identity_provision",
    entity_type: "teacher",
    entity_id: teacherId,
    new_value: { auth_user_id: authUserId, recovered },
  });
  if (error) console.error("[admin-teacher-provision] audit logging failed:", error.message);
}

export async function POST(req: Request) {
  const adminCheck = await requirePermission("teacher.manage");
  if (!adminCheck.ok) return adminCheck.response;

  if (declaredBodyExceeds(req, 4 * 1024)) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const teacherId = typeof body?.teacherId === "string" ? body.teacherId.trim() : "";
  if (!UUID_RE.test(teacherId)) return NextResponse.json({ error: "معرّف المعلم غير صالح" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: teacher } = await admin
    .from("teachers")
    .select("id, active, user_id, application_id")
    .eq("id", teacherId)
    .maybeSingle();
  if (!teacher) return NextResponse.json({ error: "المعلم غير موجود" }, { status: 404 });
  if (!teacher.active) return NextResponse.json({ error: "لا يمكن تجهيز حساب معلم غير نشط" }, { status: 409 });
  if (teacher.user_id) return NextResponse.json({ ok: true, alreadyLinked: true });
  if (!teacher.application_id) return NextResponse.json({ error: "لا يوجد طلب موثّق مرتبط بهذا المعلم" }, { status: 409 });

  const { data: application } = await admin
    .from("teacher_applications")
    .select("email, status")
    .eq("id", teacher.application_id)
    .maybeSingle();
  const email = normalizeParentEmail(application?.email ?? "");
  if (!application || application.status !== "accepted" || !email) {
    return NextResponse.json({ error: "بيانات حساب الدخول غير مكتملة وتحتاج مراجعة يدوية" }, { status: 409 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    app_metadata: { khota_provision_marker: PROVISION_MARKER, teacher_id: teacherId },
  });

  let authUser: NonNullable<typeof created.user> | null = created.user;
  let recovered = false;
  if (createError || !authUser) {
    const perPage = 1000;
    const markedMatches: NonNullable<typeof created.user>[] = [];
    // A previously registered parent/admin is never eligible for automatic
    // teacher provisioning. Keep that security boundary and explain collisions
    // to authorized operators without modifying the existing identity.
    const emailMatches: NonNullable<typeof created.user>[] = [];
    let page = 1;
    let paginationError: string | undefined;
    while (true) {
      const { data: existing, error: existingError } = await admin.auth.admin.listUsers({ page, perPage });
      if (existingError) {
        paginationError = existingError.message;
        break;
      }
      for (const candidate of existing.users) {
        if (candidate.email?.trim().toLowerCase() === email) emailMatches.push(candidate);
        if (hasProvisionProof(candidate, teacherId, email)) markedMatches.push(candidate);
      }
      if (existing.users.length < perPage) break;
      page += 1;
    }

    if (paginationError || markedMatches.length !== 1) {
      if (!paginationError && emailMatches.length === 1) {
        const existingUserId = emailMatches[0].id;
        const [{ data: parentRole, error: parentError }, { data: adminRole, error: adminError }] = await Promise.all([
          admin.from("parents").select("id").eq("user_id", existingUserId).maybeSingle(),
          admin.from("admins").select("id").eq("user_id", existingUserId).maybeSingle(),
        ]);
        if (parentError || adminError) {
          return NextResponse.json({ error: "تعذّر التحقق من تعارض صلاحيات البريد. لا يمكن ربط الحساب تلقائيًا." }, { status: 503 });
        }
        if (parentRole || adminRole) {
          return NextResponse.json({
            error: parentRole
              ? "البريد المستخدم في طلب المعلم مرتبط بحساب ولي أمر. استخدم بريدًا مستقلًا لتقديم طلب معلم جديد؛ لن نغيّر صلاحيات ولي الأمر."
              : "البريد المستخدم في طلب المعلم مرتبط بحساب إدارة. استخدم بريدًا مستقلًا لتقديم طلب معلم جديد.",
          }, { status: 409 });
        }
      }
      console.error("[admin-teacher-provision] Auth identity creation/recovery failed:", createError?.message ?? paginationError);
      return NextResponse.json({ error: "يوجد حساب بهذا البريد أو تعذّر إنشاء الحساب؛ راجع الربط يدويًا" }, { status: 409 });
    }
    authUser = markedMatches[0];
    recovered = true;
  }

  if (!authUser) return NextResponse.json({ error: "تعذّر تجهيز حساب الدخول؛ راجع الربط يدويًا" }, { status: 409 });

  const { data: owner } = await admin.from("teachers").select("id").eq("user_id", authUser.id).maybeSingle();
  if (owner && owner.id !== teacherId) {
    return NextResponse.json({ error: "حساب الدخول مرتبط بمعلم آخر؛ راجع الربط يدويًا" }, { status: 409 });
  }

  const { data: linked, error: linkError } = await admin
    .from("teachers")
    .update({ user_id: authUser.id })
    .eq("id", teacherId)
    .is("user_id", null)
    .eq("active", true)
    .select("id, user_id")
    .maybeSingle();

  if (linkError || !linked || linked.user_id !== authUser.id) {
    const { data: currentTeacher } = await admin.from("teachers").select("user_id").eq("id", teacherId).maybeSingle();
    if (currentTeacher?.user_id === authUser.id) {
      await auditProvision(admin, adminCheck.userId, teacherId, authUser.id, recovered);
      return NextResponse.json({ ok: true, alreadyLinked: true });
    }
    if (!recovered) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(authUser.id);
      if (deleteError) console.error("[admin-teacher-provision] compensation delete failed; manual recovery remains available:", deleteError.message);
    }
    if (linkError) console.error("[admin-teacher-provision] teacher link failed:", linkError.message);
    return NextResponse.json({ error: "تعذّر ربط حساب الدخول بالمعلم؛ لم يتم تفعيل الربط" }, { status: 409 });
  }

  await auditProvision(admin, adminCheck.userId, teacherId, authUser.id, recovered);

  return NextResponse.json({ ok: true, alreadyLinked: false, recovered });
}