// Normalize Supabase many-to-one relation shapes for staff session alerts.
// A to-one embedded row can be returned as an object (not only an array).
import { supabaseRelationOne, type SupabaseRelation } from "./supabase-relations";

export type SessionTeacherAlertInput = {
  status: string;
  teacher_id: string | null;
  teachers: SupabaseRelation<{ full_name: string | null; active: boolean | null }>;
};

export function getSessionTeacherAlert(session: SessionTeacherAlertInput): string | null {
  if (session.status !== "scheduled") return null;
  if (!session.teacher_id) return "بدون معلم";
  const teacher = supabaseRelationOne(session.teachers);
  if (!teacher) return "بيانات المعلم المعيّن غير متاحة";
  if (teacher.active !== true) return `المعلم المعيّن (${teacher.full_name ?? "غير محدد"}) غير نشط`;
  return null;
}
