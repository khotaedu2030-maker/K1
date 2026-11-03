import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTs(file, mockedRequire = () => { throw new Error("Unexpected import"); }) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: mockedRequire, URL });
  return mod.exports;
}
const validation = loadTs("src/lib/teaching-readiness.ts");
const join = loadTs("src/lib/meeting-join.ts", (name) => {
  if (name === "@/lib/teaching-readiness") return validation;
  throw new Error("Unexpected import: " + name);
});
function fakeBrowser(blocked = false) {
  const result = { opened: [], replaced: [], assigned: [], closed: 0 };
  const browser = {
    location: { assign: (url) => result.assigned.push(url) },
    open: (url, target) => {
      result.opened.push({ url, target });
      if (blocked) return null;
      return {
        opener: browser, closed: false,
        location: { replace: (url) => result.replaced.push(url) },
        close() { result.closed++; this.closed = true; },
      };
    },
  };
  return { browser, result };
}

const valid = "https://teams.microsoft.com/l/meetup-join/example";
{
  const { browser, result } = fakeBrowser();
  const tab = join.beginMeetingJoin(browser);
  assert.equal(result.opened.length, 1);
  assert.equal(result.opened[0].url, "about:blank");
  assert.equal(result.opened[0].target, "_blank");
  assert.equal(tab.opener, null, "new tab must not retain access to the parent window");
  assert.equal(join.finishMeetingJoin(browser, tab, valid), "opened");
  assert.deepEqual(result.replaced, [valid]);
  assert.deepEqual(result.assigned, []);
}
{
  const { browser, result } = fakeBrowser(true);
  const tab = join.beginMeetingJoin(browser);
  assert.equal(tab, null);
  assert.equal(join.finishMeetingJoin(browser, tab, valid), "opened");
  assert.deepEqual(result.assigned, [valid], "popup blocked: same-tab fallback");
}
{
  const { browser, result } = fakeBrowser();
  const tab = join.beginMeetingJoin(browser);
  assert.equal(join.finishMeetingJoin(browser, tab, "https://teams.microsoft.com.evil.test/l/meetup-join/x"), "invalid");
  assert.equal(result.closed, 1, "invalid URL must close pending tab");
  assert.deepEqual(result.replaced, []);
}
{
  const { browser, result } = fakeBrowser();
  const tab = join.beginMeetingJoin(browser);
  tab.close();
  assert.equal(join.finishMeetingJoin(browser, tab, valid), "closed");
  assert.deepEqual(result.assigned, [], "explicit close must not redirect original tab");
}
{
  const { browser, result } = fakeBrowser();
  const tab = join.beginMeetingJoin(browser);
  join.cancelMeetingJoin(tab);
  assert.equal(result.closed, 1, "API rejection must close pending tab");
}
const parentButton = readFileSync("src/app/parent/schedule/SessionJoinButton.tsx", "utf8");
const studentButton = readFileSync("src/app/student/today/StudentSessionCard.tsx", "utf8");
for (const [name, component] of [["parent", parentButton], ["student", studentButton]]) {
  assert.match(component, /beginMeetingJoin\(window\)/, name + ": open under click activation");
  assert.match(component, /finishMeetingJoin\(window, pendingTab, data\.meetingUrl\)/);
  assert.match(component, /cancelMeetingJoin\(pendingTab\)/);
  assert.doesNotMatch(component, /window\.open\(data\.meetingUrl/);
}
for (const route of ["src/app/api/attendance/mark/route.ts","src/app/api/student/attendance/mark/route.ts"]) {
  const code = readFileSync(route, "utf8");
  assert.match(code, /isTeamsMeetingUrl\(/, "validate Teams URL before attendance write: " + route);
  assert.ok(code.indexOf("isTeamsMeetingUrl(") < code.indexOf('from("attendance")'), "reject missing URLs before recording attendance");
}
console.log("PASS Teams joining: user-activated tab, blocked popup fallback, secure URL, request rejection, user close, route guards");
