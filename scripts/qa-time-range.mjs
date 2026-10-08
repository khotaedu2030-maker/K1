// فحص منطقي لتنسيق فترات الوقت العربية: node scripts/qa-time-range.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "package.json"))("typescript");
const src = fs.readFileSync(path.join(root, "src/lib/plan-display.ts"), "utf8");
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(out, { module: mod, exports: mod.exports, Number, String, Array, Boolean });
const { formatClockAr, formatTimeRangeAr } = mod.exports;

assert.equal(formatTimeRangeAr("16:30:00", "17:30:00"), "من 4:30 م إلى 5:30 م");
assert.equal(formatTimeRangeAr("09:00", "10:15"), "من 9:00 ص إلى 10:15 ص");
assert.equal(formatClockAr("00:05"), "12:05 ص");
assert.equal(formatClockAr("12:00"), "12:00 م");
assert.ok(!/[–—-]/.test(formatTimeRangeAr("16:30", "17:30")), "لا رموز فاصلة تتأثر باتجاه RTL");

console.log("time-range checks passed");
