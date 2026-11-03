// Parent task view is informational; student changes completion and teacher handles review.
export type ParentTask = {
  id: string;
  title: string;
  subject: string | null;
  status: "pending" | "done" | "needs_review";
  due_date: string | null;
  created_at: string | null;
};

export function summarizeParentTasks(rows: readonly ParentTask[], todayInRiyadh: string): {
  pending: ParentTask[];
  done: ParentTask[];
  needsReview: ParentTask[];
  overdueCount: number;
} {
  const pending: ParentTask[] = [];
  const done: ParentTask[] = [];
  const needsReview: ParentTask[] = [];
  for (const task of rows) {
    if (task.status === "done") done.push(task);
    else if (task.status === "needs_review") needsReview.push(task);
    else if (task.status === "pending") pending.push(task);
  }
  // ISO date-only keys are compared lexically. Do not reinterpret date in server timezone.
  pending.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
  return {
    pending, done, needsReview,
    overdueCount: pending.filter((task) => task.due_date !== null && task.due_date < todayInRiyadh).length,
  };
}
