// Payment callback query flags are untrusted; the server's owned subscription
// row must authorize any success state. This check performs no payments or API writes.
import assert from "node:assert/strict";
import fs from "node:fs";
const client=fs.readFileSync("src/app/motabaa/enroll/payment/PaymentClient.tsx","utf8");
const page=fs.readFileSync("src/app/motabaa/enroll/payment/page.tsx","utf8");
assert.match(page,/select\("parent_id, status, children\(grade\)/);
assert.match(page,/sub\.parent_id !== context\.parentId/);
assert.match(page,/if \(!sub \|\| sub\.parent_id !== context\.parentId\)/);
assert.match(page,/if \(queryError\) throw queryError/);
assert.match(page,/lookupError = true/);
assert.match(page,/subscriptionStatus=\{subscriptionStatus\}/);
assert.match(client,/const done = completed \|\| subscriptionStatus === "active"/);
assert.doesNotMatch(client,/const done = completed \|\| callbackStatus === "paid"/);
assert.match(client,/callbackStatus === "paid" && !done/);
assert.match(client,/subscriptionStatus !== "pending_payment"/);
assert.match(client,/تم حفظ طلب تسجيلك/);
assert.match(page,/paymentsEnabled \? "أكمل اشتراكك" : "طلب تسجيل طفلك"/);
const subscriptions=fs.readFileSync("src/app/parent/subscriptions/page.tsx","utf8");
assert.match(subscriptions,/areOnlinePaymentsEnabled/);
assert.match(subscriptions,/paymentsEnabled \? statusLabel\.pending_payment : "الطلب محفوظ — بانتظار التفعيل"/);
assert.match(subscriptions,/getGradeLabelArabic/);
assert.match(client,/الاشتراك ليس مفعّلًا بعد/);
console.log("PASS checkout success requires server-verified active ownership and never trusts paid=1 URL");
