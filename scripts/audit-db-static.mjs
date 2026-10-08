// تدقيق ثابت لملفات SQL (بلا اتصال بقاعدة بيانات): node scripts/audit-db-static.mjs
// يستخرج: الجداول، تفعيل RLS، السياسات (بعد مراعاة DROP POLICY)، GRANT/REVOKE على الجداول،
// ودوال SECURITY DEFINER مع صلاحيات EXECUTE. الحالة الفعلية في قاعدة الإنتاج تحتاج فحصًا حيًّا.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase");
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".sql")) files.push(p);
  }
})(root);
// schema.sql أولًا ثم migrations بترتيب الاسم
files.sort((a, b) => {
  const rank = (f) => (path.basename(f) === "schema.sql" ? 0 : f.includes(`${path.sep}migrations${path.sep}`) ? 1 : 2);
  return rank(a) - rank(b) || a.localeCompare(b);
});
const only = files.filter((f) => path.basename(f) === "schema.sql" || f.includes(`${path.sep}migrations${path.sep}`));

const strip = (s) => s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const tables = new Map();
const policies = new Map(); // table -> Map(name -> info)
const rls = new Map();
const fnDefiner = new Map(); // name -> {file}
const fnGrants = new Map(); // name -> {revokedFrom:Set, grantedTo:Set}
const tableGrants = [];
const norm = (s) => s.replace(/\s+/g, " ").trim();
const tname = (s) => s.replace(/"/g, "").replace(/^public\./, "").toLowerCase();

for (const f of only) {
  const sql = strip(fs.readFileSync(f, "utf8"));
  const rel = path.relative(root, f).replace(/\\/g, "/");
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)) tables.set(tname(m[1]), rel);
  for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+(enable|disable|force)\s+row\s+level\s+security/gi)) {
    const t = tname(m[1]);
    const cur = rls.get(t) ?? { enabled: false, forced: false };
    if (m[2].toLowerCase() === "enable") cur.enabled = true;
    if (m[2].toLowerCase() === "disable") cur.enabled = false;
    if (m[2].toLowerCase() === "force") cur.forced = true;
    rls.set(t, cur);
  }
  for (const m of sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"?([\w ]+?)"?\s+on\s+([\w."]+)/gi)) policies.get(tname(m[2]))?.delete(m[1].trim());
  for (const m of sql.matchAll(/create\s+policy\s+"?([\w ]+?)"?\s+on\s+([\w."]+)([\s\S]*?);/gi)) {
    const t = tname(m[2]);
    const body = norm(m[3]);
    const forCmd = /for\s+(all|select|insert|update|delete)/i.exec(body)?.[1] ?? "all";
    const to = /\bto\s+([\w, ]+?)(?:\s+using|\s+with|$)/i.exec(body)?.[1] ?? "public";
    if (!policies.has(t)) policies.set(t, new Map());
    policies.get(t).set(m[1].trim(), { cmd: forCmd.toLowerCase(), to: to.trim(), expr: body.replace(/^.*?(using|with check)/i, "$1").slice(0, 170), file: rel });
  }
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?(?=\$\$|as\s+\$)/gi)) {
    if (/security\s+definer/i.test(m[0])) fnDefiner.set(m[1], rel);
  }
  for (const m of sql.matchAll(/(revoke|grant)\s+(all|execute|select|insert|update|delete)([\w, ]*?)\s+on\s+(function|table|all tables in schema|all functions in schema|sequence)?\s*([\w."]*)[\s\S]*?\s+(from|to)\s+([\w, "]+?);/gi)) {
    const verb = m[1].toLowerCase();
    const kind = (m[4] ?? "table").toLowerCase();
    const obj = tname(m[5] || "");
    const roles = m[7].split(",").map((r) => r.trim().toLowerCase());
    if (kind === "function") {
      const e = fnGrants.get(obj) ?? { revoked: new Set(), granted: new Set() };
      for (const r of roles) (verb === "revoke" ? e.revoked : e.granted).add(r);
      fnGrants.set(obj, e);
    } else tableGrants.push({ verb, priv: m[2].toLowerCase(), obj: obj || `(${kind})`, roles, rel });
  }
}

const out = [];
out.push(`## الجداول (${tables.size}) — RLS والسياسات`);
out.push("| الجدول | RLS | سياسات (الأمر/الدور) |");
out.push("|---|---|---|");
const flagged = [];
for (const [t] of [...tables].sort()) {
  const r = rls.get(t);
  const ps = [...(policies.get(t) ?? new Map())];
  out.push(`| ${t} | ${r?.enabled ? "ON" : "OFF/غير موجود"} | ${ps.map(([n, p]) => `${n} (${p.cmd}→${p.to})`).join("؛ ") || "—"} |`);
  if (!r?.enabled) flagged.push(`RLS غير مفعّل لجدول ${t}`);
  for (const [n, p] of ps) {
    if (/\bpublic\b|anon/.test(p.to) && p.cmd !== "select") flagged.push(`سياسة ${n} على ${t} تسمح بـ${p.cmd} لـ${p.to}`);
    if (/using\s*\(\s*true\s*\)/i.test(p.expr) && /authenticated|public|anon/.test(p.to)) flagged.push(`سياسة ${n} على ${t}: USING (true) لـ${p.to}`);
  }
}
out.push("\n## سياسات تحتاج انتباهًا");
out.push(flagged.length ? flagged.map((x) => `- ${x}`).join("\n") : "- لا شيء");
out.push("\n## تفاصيل السياسات (تعبير USING/CHECK)");
for (const [t, m] of [...policies].sort()) for (const [n, p] of m) out.push(`- ${t} :: ${n} [${p.cmd}→${p.to}] ${p.expr}`);
out.push(`\n## دوال SECURITY DEFINER (${fnDefiner.size})`);
for (const [n, file] of [...fnDefiner].sort()) {
  const g = fnGrants.get(n);
  out.push(`- ${n} — revoke: ${g ? [...g.revoked].join(",") || "—" : "غير موجود"} | grant: ${g ? [...g.granted].join(",") || "—" : "غير موجود"} (${file})`);
}
out.push("\n## GRANT/REVOKE على الجداول");
for (const g of tableGrants) out.push(`- ${g.verb} ${g.priv} on ${g.obj} ${g.verb === "grant" ? "to" : "from"} ${g.roles.join(",")} (${g.rel})`);
console.log(out.join("\n"));
