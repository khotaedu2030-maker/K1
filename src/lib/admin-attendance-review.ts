import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type CompletedSession = { id: string; cohort_id: string; session_date: string };
export type AttendanceRecord = { session_id: string; child_id: string };
export type ActiveEnrollment = { cohort_id: string | null; child_id: string | null; start_date: string | null };
export type AttendanceReview = { unrecordedSessionIds: string[]; partialSessionIds: string[]; error: boolean };

// This detects review candidates. Historical enrollment status is not preserved in these queries,
// so a missing row relative to the CURRENT active roster is a possible gap, not a final ruling.
export function classifyAttendanceReview(
  sessions: CompletedSession[],
  attendance: AttendanceRecord[],
  enrollments: ActiveEnrollment[],
): Omit<AttendanceReview, "error"> {
  const bySession = new Map<string, Set<string>>();
  for (const record of attendance) {
    if (!bySession.has(record.session_id)) bySession.set(record.session_id, new Set());
    bySession.get(record.session_id)!.add(record.child_id);
  }
  const byCohort = new Map<string, ActiveEnrollment[]>();
  for (const enrollment of enrollments) {
    if (!enrollment.cohort_id || !enrollment.child_id) continue;
    const group = byCohort.get(enrollment.cohort_id) ?? [];
    group.push(enrollment);
    byCohort.set(enrollment.cohort_id, group);
  }

  const unrecordedSessionIds: string[] = [];
  const partialSessionIds: string[] = [];
  for (const session of sessions) {
    const recorded = bySession.get(session.id) ?? new Set<string>();
    if (recorded.size === 0) {
      unrecordedSessionIds.push(session.id);
      continue;
    }
    const activeAtOrBefore = (byCohort.get(session.cohort_id) ?? [])
      .filter((enrollment) => !enrollment.start_date || enrollment.start_date <= session.session_date);
    if (activeAtOrBefore.some((enrollment) => !recorded.has(enrollment.child_id!))) {
      partialSessionIds.push(session.id);
    }
  }
  return { unrecordedSessionIds, partialSessionIds };
}

// Fetch the WHOLE seven-day attendance set, independently of the 200 recent rows displayed
// in the admin table. Pagination avoids falsely flagging sessions omitted from a truncated query.
export async function getRecentAttendanceReview(sessions: CompletedSession[]): Promise<AttendanceReview> {
  const empty = { unrecordedSessionIds: [] as string[], partialSessionIds: [] as string[], error: false };
  if (sessions.length === 0) return empty;
  const supabase = createSupabaseAdminClient();
  const ids = [...new Set(sessions.map((session) => session.id))];
  const cohorts = [...new Set(sessions.map((session) => session.cohort_id))];
  const attendance: AttendanceRecord[] = [];
  const enrollments: ActiveEnrollment[] = [];
  const pageSize = 400;
  // Safety bound: if the query is ever unexpectedly huge, surface "unable to verify"
  // rather than presenting incomplete results as correct.
  const maximumRows = 20000;

  for (let offset = 0; offset < maximumRows; offset += pageSize) {
    const { data, error } = await supabase.from("attendance")
      .select("session_id, child_id").in("session_id", ids)
      .order("session_id").order("child_id").range(offset, offset + pageSize - 1);
    if (error || !data) return { ...empty, error: true };
    attendance.push(...data);
    if (data.length < pageSize) break;
    if (offset + pageSize >= maximumRows) return { ...empty, error: true };
  }

  if (cohorts.length) {
    for (let offset = 0; offset < maximumRows; offset += pageSize) {
      const { data, error } = await supabase.from("subscriptions")
        .select("cohort_id, child_id, start_date").in("cohort_id", cohorts)
        .eq("status", "active").order("id").range(offset, offset + pageSize - 1);
      if (error || !data) return { ...empty, error: true };
      enrollments.push(...data);
      if (data.length < pageSize) break;
      if (offset + pageSize >= maximumRows) return { ...empty, error: true };
    }
  }

  return { ...classifyAttendanceReview(sessions, attendance, enrollments), error: false };
}
