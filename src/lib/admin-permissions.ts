// Single source of truth for KHOTA admin roles/permissions. Client-safe: no
// "server-only" import and no server-side dependencies, so both server code
// (require-admin.ts, admin-identity.ts) and client components (AdminShell)
// can rely on the exact same authorization rules.

export type AdminRole = "super_admin" | "operations_manager" | "finance_admin" | "admin_support";

export type AdminPermission =
  | "settings.manage"
  | "cohort.manage"
  | "session.manage"
  | "teacher.manage"
  | "teacher_application.review"
  | "makeup.manage"
  | "subscription.review"
  | "parent.context.read"
  | "payment.read"
  | "admin.manage"
  | "student.read"
  | "attendance.read"
  | "request.read"
  | "support.manage"
  | "exception.manage"
  | "messages.metadata.read"
  | "reports.read"
  | "audit.read";

const ALL_PERMISSIONS: readonly AdminPermission[] = [
  "settings.manage",
  "cohort.manage",
  "session.manage",
  "teacher.manage",
  "teacher_application.review",
  "makeup.manage",
  "subscription.review",
  "parent.context.read",
  "payment.read",
  "admin.manage",
  "student.read",
  "attendance.read",
  "request.read",
  "support.manage",
  "exception.manage",
  "messages.metadata.read",
  "reports.read",
  "audit.read",
];

const OPERATIONS_MANAGER_PERMISSIONS: readonly AdminPermission[] = [
  "cohort.manage",
  "session.manage",
  "teacher.manage",
  "teacher_application.review",
  "makeup.manage",
  "subscription.review",
  "parent.context.read",
  "student.read",
  "attendance.read",
  "request.read",
  "support.manage",
  "exception.manage",
  "messages.metadata.read",
  "reports.read",
];

const FINANCE_ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  "subscription.review",
  "parent.context.read",
  "payment.read",
  "reports.read",
];

const ADMIN_SUPPORT_PERMISSIONS: readonly AdminPermission[] = [
  "teacher_application.review",
  "parent.context.read",
  "student.read",
  "attendance.read",
  "request.read",
  "support.manage",
  "messages.metadata.read",
];

const ROLE_PERMISSIONS: Readonly<Record<AdminRole, ReadonlySet<string>>> = {
  super_admin: new Set(ALL_PERMISSIONS),
  operations_manager: new Set(OPERATIONS_MANAGER_PERMISSIONS),
  finance_admin: new Set(FINANCE_ADMIN_PERMISSIONS),
  admin_support: new Set(ADMIN_SUPPORT_PERMISSIONS),
};

const KNOWN_ROLES: ReadonlySet<string> = new Set<AdminRole>([
  "super_admin",
  "operations_manager",
  "finance_admin",
  "admin_support",
]);

export function isKnownAdminRole(role: string | null | undefined): role is AdminRole {
  return Boolean(role) && KNOWN_ROLES.has(role as string);
}

// Unknown role -> no permissions. Unknown permission -> denied (Set.has returns false).
export function adminRoleHasPermission(role: string | null | undefined, permission: string): boolean {
  if (!isKnownAdminRole(role)) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}
