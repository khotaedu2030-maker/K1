// Signup/mobile enrollment recovery regression. No real credentials or remote auth.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const ts=createRequire(path.join(root,"package.json"))("typescript");
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(read("src/lib/phone.ts"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,{module:mod,exports:mod.exports});
const local=mod.exports.toSaudiLocalDisplayPhone;
assert.equal(local("+966559992028"),"0559992028");
assert.equal(local("966559992028"),"0559992028");
assert.equal(local("0559992028"),"0559992028");
assert.equal(local("00966559992028"),null);
assert.equal(local("0200000000"),null);
assert.equal(local(""),null);

const auth=read("src/components/AuthForm.tsx");
assert.match(auth,/toSaudiLocalDisplayPhone\(pending\.phone\)/);
assert.match(auth,/isValidSaudiLocalPhone\(phone\)/);
assert.match(auth,/if \(mode === "signup"\)/);
assert.ok(auth.indexOf("isValidSaudiLocalPhone(phone)") <
  auth.indexOf('fetch("/api/auth/otp/request"'),"Validate phone before any signup OTP");
const form=read("src/app/motabaa/enroll/EnrollForm.tsx");
assert.match(form,/try \{/);
assert.match(form,/catch \{/);
assert.match(form,/finally \{\s*setLoading\(false\)/);
assert.match(form,/sessionStorage\.setItem\("khota_pending_enrollment"/);
assert.match(form,/typeof data\.subscriptionId !== "string"/);
assert.match(form,/account\?\.savedProfile/,"Authenticated parent profile summary must be shown without repeated inputs");
assert.match(form,/if \(!account\) \{/,"Only unauthenticated checkout may request a fresh browser session");
assert.match(form,/if \(res\.status === 401\)/,"Expired sessions must recover with login and pending form preservation");
assert.match(form,/router\.push\(\x60\/login\?next=/,"Expired signed-in session must never redirect to signup");
assert.match(form,/لا حاجة لرمز تحقق جديد/,"Signed-in parent must not be asked for OTP again");
const enrollPage=read("src/app/motabaa/enroll/page.tsx");
assert.match(enrollPage,/getActiveStaffRole\(user\.id\)/);
assert.match(enrollPage,/\.eq\("user_id", user\.id\)/);
assert.match(enrollPage,/toSaudiLocalDisplayPhone\(parent\?\.phone \?\? ""\)/);
assert.match(enrollPage,/account=\{account\}/);
const complete=read("src/app/motabaa/enroll/complete/page.tsx");
assert.match(complete,/AbortController/);
assert.match(complete,/25_000/);
assert.match(complete,/submittedRef\.current/);
assert.match(complete,/status === "auth"/);
assert.match(complete,/إعادة المحاولة/);
assert.match(complete,/sessionStorage\.removeItem\(STORAGE_KEY\)/);
assert.match(complete,/router\.replace/);
const earlier=complete.indexOf('sessionStorage.removeItem(STORAGE_KEY)');
const success=complete.indexOf("if (!res.ok)");
assert.ok(earlier>success,"Never remove pending payload before successful enrollment");
const api=read("src/app/api/enroll/route.ts");
assert.doesNotMatch(api,/console\.error\(\x60[^\n]*(?:\$\{email\}|\$\{bodyEmail\}|\$\{normalizedPhone\})/);
console.log("PASS signup phone normalization, validation before OTP, recoverable enrollment retry, no PII error logs");
