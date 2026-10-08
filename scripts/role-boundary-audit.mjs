// اختبار انحدار لحدود الأدوار (بدون شبكة/Supabase حقيقي): يحمّل مساعدات الصلاحيات الفعلية
// ويشغّلها بمحاكاة لـ Supabase. التشغيل: node scripts/role-boundary-audit.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

let failures = 0;
function check(name, cond) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
}

// ---- محاكاة DB: admins / teachers بحسب user_id + active ----
const DB = {
  admins: [
    { id: "a1", user_id: "u-super", role: "super_admin", active: true },
    { id: "a2", user_id: "u-ops", role: "operations_manager", active: true },
    { id: "a3", user_id: "u-fin", role: "finance_admin", active: true },
    { id: "a4", user_id: "u-sup", role: "admin_support", active: true },
    { id: "a5", user_id: "u-disabled-admin", role: "super_admin", active: false },
    { id: "a6", user_id: "u-weird", role: "root", active: true },
  ],
  teachers: [
    { id: "t1", user_id: "u-teacher", active: true },
    { id: "t2", user_id: "u-teacher-off", active: false },
  ],
};
let currentUser = null;
const queried = [];

function adminClient() {
  return {
    from(table) {
      const filters = {};
      const qb = {
        select: () => qb,
        eq: (k, v) => ((filters[k] = v), qb),
        maybeSingle: async () => {
          queried.push(table);
          const row = (DB[table] ?? []).find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
          return { data: row ? { ...row } : null };
        },
      };
      return qb;
    },
  };
}

class FakeResponse {
  constructor(body, status) { this.body = body; this.status = status; }
  static json(body, init) { return new FakeResponse(body, init?.status ?? 200); }
}

const mocks = {
  "server-only": {},
  "next/server": { NextResponse: FakeResponse },
  "@/lib/supabase-server": {
    createSupabaseServerClient: async () => ({
      auth: { getUser: async () => ({ data: { user: currentUser ? { id: currentUser } : null } }) },
    }),
  },
  "@/lib/supabase-admin": { createSupabaseAdminClient: adminClient },
};

function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const req = (id) => {
    if (id === "@/lib/admin-permissions") return loaded.perms;
    if (id in mocks) return mocks[id];
    throw new Error(`unmocked import: ${id}`);
  };
  vm.runInNewContext(out, { module: mod, exports: mod.exports, require: req, Promise, Set, Boolean, Object, Map });
  return mod.exports;
}
const loaded = {};
loaded.perms = load("src/lib/admin-permissions.ts");
const { requireAdmin, requirePermission } = load("src/lib/require-admin.ts");
const { requireTeacher } = load("src/lib/require-teacher.ts");

// ---- مصفوفة الصلاحيات لكل دور ----
const personas = {
  anon: null,
  parent: "u-parent",
  teacher: "u-teacher",
  admin_support: "u-sup",
  finance_admin: "u-fin",
  operations_manager: "u-ops",
  super_admin: "u-super",
};

const permissionExpectations = {
  "admin.manage": ["super_admin"],
  "settings.manage": ["super_admin"],
  "payment.read": ["super_admin", "finance_admin"],
  "cohort.manage": ["super_admin", "operations_manager"],
  "session.manage": ["super_admin", "operations_manager"],
  "teacher.manage": ["super_admin", "operations_manager"],
  "subscription.review": ["super_admin", "operations_manager", "finance_admin"],
  "teacher_application.review": ["super_admin", "operations_manager", "admin_support"],
  "support.manage": ["super_admin", "operations_manager", "admin_support"],
  "parent.context.read": ["super_admin", "operations_manager", "finance_admin", "admin_support"],
};

for (const [permission, allowedRoles] of Object.entries(permissionExpectations)) {
  for (const [persona, uid] of Object.entries(personas)) {
    currentUser = uid;
    const r = await requirePermission(permission);
    const shouldPass = allowedRoles.includes(persona);
    let ok;
    if (shouldPass) ok = r.ok === true;
    else if (persona === "anon") ok = r.ok === false && r.response.status === 401;
    else ok = r.ok === false && r.response.status === 403;
    check(`admin ${permission} :: ${persona} -> ${shouldPass ? "allow" : persona === "anon" ? "401" : "403"}`, ok);
  }
}

// حساب إداري معطّل أو بدور غير معروف = رفض؛ أدوار الإدارة لا تمنح صلاحيات معلم
for (const [label, uid] of [["inactive admin", "u-disabled-admin"], ["unknown role", "u-weird"]]) {
  currentUser = uid;
  const r = await requirePermission("parent.context.read");
  check(`admin ${label} -> 403`, r.ok === false && r.response.status === 403);
}
for (const persona of ["super_admin", "operations_manager", "finance_admin", "admin_support"]) {
  currentUser = personas[persona];
  const r = await requireTeacher();
  check(`teacher API :: ${persona} (no teacher row) -> 403 (no implicit teacher power)`, r.ok === false && r.response.status === 403);
}

// ---- requireTeacher: 401 بلا جلسة، 403 لغير المعلم/المعطّل، ونجاح للمعلم النشط ----
{
  currentUser = null;
  queried.length = 0;
  const r = await requireTeacher();
  check("teacher API :: anon -> 401", r.ok === false && r.response.status === 401);
  check("teacher API :: anon -> no DB lookup", queried.length === 0);

  currentUser = "u-parent";
  const p = await requireTeacher();
  check("teacher API :: parent -> 403", p.ok === false && p.response.status === 403);

  currentUser = "u-teacher-off";
  const off = await requireTeacher();
  check("teacher API :: inactive teacher -> 403", off.ok === false && off.response.status === 403);

  currentUser = "u-teacher";
  const t = await requireTeacher();
  check("teacher API :: active teacher -> allow with own teacherId", t.ok === true && t.teacherId === "t1");

  currentUser = "u-teacher";
  const a = await requireAdmin();
  check("admin API :: teacher -> 403 (no implicit admin power)", a.ok === false && a.response.status === 403);
}

// ---- parents/[id]: رؤية المدفوعات تتبع payment.read ولا تتبع اسم الدور ----
{
  const { adminRoleHasPermission } = loaded.perms;
  const viewers = ["super_admin", "operations_manager", "finance_admin", "admin_support"].filter((r) => adminRoleHasPermission(r, "payment.read"));
  check("payment.read holders == super_admin + finance_admin", viewers.join(",") === "super_admin,finance_admin");
  check("unknown role has no permission", adminRoleHasPermission("root", "payment.read") === false && adminRoleHasPermission(null, "x") === false);
}

console.log(failures === 0 ? "\nALL ROLE-BOUNDARY CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
