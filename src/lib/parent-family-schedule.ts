// Source of truth for a parent's own child/cohort links. Only feed subscriptions
// already constrained to the verified parent's owned child IDs.
export type CohortChild = { id: string; name: string };
export type SubscribedChild = { cohort_id: string | null; child_id: string };
export type FamilySession = { id: string; cohort_id: string; starts_at: string; status: string };
export type FamilyAttendance = { session_id: string; child_id: string; status: string };

export function groupParentCohortChildren(
  subs: readonly SubscribedChild[],
  ownedChildNames: ReadonlyMap<string, string>,
): Map<string, CohortChild[]> {
  const result = new Map<string, CohortChild[]>();
  for (const sub of subs) {
    if (!sub.cohort_id || !ownedChildNames.has(sub.child_id)) continue;
    const children = result.get(sub.cohort_id) ?? [];
    if (children.some((child) => child.id === sub.child_id)) continue;
    children.push({ id: sub.child_id, name: ownedChildNames.get(sub.child_id) || "الطالب" });
    result.set(sub.cohort_id, children);
  }
  return result;
}

export function summarizeFamilyWeek(
  sessions: readonly FamilySession[],
  attendance: readonly FamilyAttendance[],
  groupChildren: ReadonlyMap<string, CohortChild[]>,
  now: Date,
): { totalSessions: number; attended: number; upcoming: number } {
  const eligible = new Set<string>();
  let upcoming = 0;
  for (const session of sessions) {
    if (session.status !== "scheduled" && session.status !== "completed") continue;
    for (const child of groupChildren.get(session.cohort_id) ?? []) {
      eligible.add(session.id + ":" + child.id);
      if (session.status === "scheduled" && new Date(session.starts_at) >= now) upcoming++;
    }
  }
  const attended = new Set(
    attendance.filter((row) => row.status === "present")
      .map((row) => row.session_id + ":" + row.child_id)
      .filter((key) => eligible.has(key)),
  ).size;
  return { totalSessions: eligible.size, attended, upcoming };
}
