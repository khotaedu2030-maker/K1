import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// تحديث بيانات مجموعة (تشغيلية + سعة/تسجيل) — يمر بالكامل عبر Server API محمي، لا كتابة
// مباشرة من المتصفح إطلاقًا. requireAdmin() هو الفحص المركزي لصلاحية الإدارة. التحديث الفعلي
// (السعة/الحالة/المعلم/الرابط) يتم عبر RPC ذرّي واحد (admin_update_cohort_operations_atomic) —
// لا "احسب المحتسَب ثم حدِّث" منفصلَين من JavaScript، فلا نافذة سباق بين القراءة والكتابة.
export async function POST(req: Request) {
  const adminCheck = await requirePermission("cohort.manage");
  if (!adminCheck.ok) return adminCheck.response;

  const admin = createSupabaseAdminClient();

  const body = await req.json().catch(() => null);
  const cohortId = body?.cohortId as string | undefined;
  const meetingUrlRaw = body?.meetingUrl as string | undefined;
  const teacherIdRaw = body?.teacherId as string | undefined;
  const capacityRaw = body?.capacity;
  const statusRaw = body?.status as string | undefined;

  if (!cohortId) return NextResponse.json({ error: "cohortId مطلوب" }, { status: 400 });

  // --- تحقق مبكر بأخطاء واضحة (قبل استدعاء RPC) ---
  let meetingUrl: string | null | undefined;
  if (meetingUrlRaw !== undefined) {
    meetingUrl = meetingUrlRaw?.trim() || null;
    if (meetingUrl) {
      let parsed: URL;
      try {
        parsed = new URL(meetingUrl);
      } catch {
        return NextResponse.json({ error: "رابط الجلسة غير صالح" }, { status: 400 });
      }
      // new URL() وحدها لا ترفض javascript:/data:/file: — تتحقق فقط أن الصيغة قابلة للتحليل.
      // نرفض صراحةً أي بروتوكول غير http/https.
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "رابط الجلسة غير صالح" }, { status: 400 });
      }
    }
  }

  let teacherId: string | null | undefined;
  if (teacherIdRaw !== undefined) {
    teacherId = teacherIdRaw?.trim() || null;
    if (teacherId) {
      // active=true إلزامي هنا — يمنع تعيين معلم غير نشط حتى لو أُرسل id صالح يدويًا
      // (مباشرة عبر الـAPI بمعزل عن الواجهة، التي أصلًا لا تعرض إلا المعلمين النشطين).
      const { data: teacher } = await admin.from("teachers").select("id").eq("id", teacherId).eq("active", true).maybeSingle();
      if (!teacher) return NextResponse.json({ error: "معلم غير موجود أو غير نشط" }, { status: 400 });
    }
  }

  let capacity: number | undefined;
  if (capacityRaw !== undefined) {
    capacity = Number(capacityRaw);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
      return NextResponse.json({ error: "السعة يجب أن تكون رقمًا صحيحًا بين 1 و20" }, { status: 400 });
    }
  }

  if (statusRaw !== undefined && statusRaw !== "open" && statusRaw !== "closed") {
    // "مكتملة"/"full" ليست حالة تُختار من هنا — مشتقة تلقائيًا من السعة الفعلية.
    return NextResponse.json({ error: "حالة تسجيل غير صالحة" }, { status: 400 });
  }

  if (capacity === undefined && statusRaw === undefined && teacherId === undefined && meetingUrl === undefined) {
    return NextResponse.json({ error: "لا يوجد تعديل لحفظه" }, { status: 400 });
  }

  // --- التحديث الذرّي الفعلي — قفل + حساب + رفض/تحديث داخل معاملة واحدة في قاعدة البيانات ---
  const { data: rpcResult, error: rpcError } = await admin.rpc("admin_update_cohort_operations_atomic", {
    p_cohort_id: cohortId,
    p_capacity: capacity ?? null,
    p_status: statusRaw ?? null,
    p_teacher_id: teacherId ?? null,
    p_teacher_id_provided: teacherId !== undefined,
    p_meeting_url: meetingUrl ?? null,
    p_meeting_url_provided: meetingUrl !== undefined,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    if (msg.includes("cohort_not_found")) return NextResponse.json({ error: "مجموعة غير موجودة" }, { status: 404 });
    if (msg.includes("capacity_below_occupied")) {
      return NextResponse.json({ error: "لا يمكن تقليل السعة عن عدد المسجلين الحاليين." }, { status: 409 });
    }
    if (msg.includes("invalid_status") || msg.includes("invalid_capacity")) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    console.error(`[cohort-operations] فشل RPC admin_update_cohort_operations_atomic للمجموعة ${cohortId}:`, msg);
    return NextResponse.json({ error: "تعذّر حفظ التعديل" }, { status: 500 });
  }

  const result = rpcResult?.[0];

  // سجل تدقيق خفيف — best-effort، لا يُفشِل الطلب إن فشل هو نفسه (الحفظ الفعلي تم بنجاح أصلًا).
  // القيم القديمة/الجديدة من نتيجة RPC نفسها (داخل نفس المعاملة)، لا من قراءة منفصلة سابقة.
  if (result) {
    const auditLogs: { action: string; old_value: unknown; new_value: unknown }[] = [];
    if (capacity !== undefined && result.old_capacity !== result.new_capacity) {
      auditLogs.push({ action: "capacity_change", old_value: result.old_capacity, new_value: result.new_capacity });
    }
    if (statusRaw !== undefined && result.old_status !== result.new_status) {
      auditLogs.push({ action: "registration_status_change", old_value: result.old_status, new_value: result.new_status });
    }
    if (teacherId !== undefined && result.old_teacher_id !== result.new_teacher_id) {
      auditLogs.push({ action: "teacher_assignment", old_value: result.old_teacher_id, new_value: result.new_teacher_id });
    }

    if (auditLogs.length > 0) {
      const { error: auditError } = await admin.from("admin_actions").insert(
        auditLogs.map((log) => ({
          admin_user_id: adminCheck.userId,
          action: log.action,
          entity_type: "cohort",
          entity_id: cohortId,
          old_value: log.old_value,
          new_value: log.new_value,
        }))
      );
      if (auditError) console.error("[cohort-operations] فشل تسجيل admin_actions (غير حاجب):", auditError.message);
    }
  }

  // الجلسات تحتفظ بنسخة من meeting_url وقت توليدها — يجب تحديثها أيضًا سواء أُضيف/عُدِّل الرابط
  // أو أُزيل بالكامل (null)، وإلا يبقى ولي الأمر يرى رابطًا قديمًا خاطئًا أو رابطًا أُزيل عمدًا.
  // خطوة تابعة (ليست جزءًا من المعاملة الذرّية أعلاه — لا علاقة لها بسلامة السعة نفسها).
  if (meetingUrl !== undefined) {
    const { error: sessionsUpdateError } = await admin
      .from("sessions")
      .update({ meeting_url: meetingUrl })
      .eq("cohort_id", cohortId)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString());
    if (sessionsUpdateError) {
      console.error(`[cohort-operations] فشل تحديث meeting_url بجلسات المجموعة ${cohortId}:`, sessionsUpdateError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
