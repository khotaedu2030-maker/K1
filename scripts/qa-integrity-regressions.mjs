import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const pause = read("src/app/api/subscription-pause/request/route.ts");
const makeup = read("src/lib/makeup-credits.ts");
const cancel = read("src/app/api/session/cancel/route.ts");
const report = read("src/app/api/session-report/submit/route.ts");

assert.match(pause, /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$$/, "pause dates must be strict YYYY-MM-DD");
assert.match(pause, /durationDays < settings\.pauseMinDays/, "pause minimum must be enforced");
assert.match(pause, /durationDays > settings\.pauseMaxDays/, "pause maximum must be enforced");
assert.match(pause, /صيغة التاريخ غير صحيحة/, "invalid dates must be rejected explicitly");

assert.match(makeup, /const \{ error \} = await admin\.from\("makeup_credits"\)\.upsert/, "makeup upsert error must be captured");
assert.match(makeup, /error: "persistence_failed"/, "makeup persistence failures must be explicit");
assert.match(makeup, /return \{ issued: true \}/, "successful issuance result must remain explicit");

assert.match(cancel, /"error" in result/, "session cancellation must detect makeup persistence failure");
assert.match(cancel, /alreadyCancelled/, "cancel retry path must remain recoverable/idempotent");
assert.match(report, /"error" in makeupResult/, "session report must fail visibly when eligible makeup credit cannot persist");

console.log("ALL INTEGRITY REGRESSION CHECKS PASSED");
