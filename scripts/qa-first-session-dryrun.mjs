// No network or payment writes: executes the EXACT original production
// private session-preparation function with a fake Supabase client.
import assert from "node:assert/strict";
import { simulateFirstMonthSessionPreparation, riyadhTime } from "./qa-first-session-generator-harness.mjs";

const cohort={id:"synthetic-cohort",teacher_id:"synthetic-teacher",capacity:4,
  days_of_week:[1,3],start_time:"17:00",end_time:"17:45",meeting_url:null};
const {result,writtenRows,callOptions,writeCount}=
  await simulateFirstMonthSessionPreparation({cohort});
assert.equal(result.ok,true);
assert.ok(result.sessionsToInsert.length>=8 && result.sessionsToInsert.length<=11);
assert.equal(result.sessionsToInsert.length,writtenRows.length);
assert.equal(writeCount,1,"Session preparation must batch upsert instead of duplicate inserts");
assert.equal(callOptions.onConflict,"cohort_id,starts_at");
assert.equal(callOptions.ignoreDuplicates,true);
for(const item of writtenRows){
  assert.equal(item.cohort_id,cohort.id);
  assert.equal(item.teacher_id,cohort.teacher_id);
  assert.equal(item.status,"scheduled");
  assert.equal(riyadhTime.getRiyadhDayOfWeek(new Date(item.starts_at))===1||
    riyadhTime.getRiyadhDayOfWeek(new Date(item.starts_at))===3,true);
  assert.equal(riyadhTime.getRiyadhMinutesSinceMidnight(new Date(item.starts_at)),17*60);
  assert.equal(new Date(item.ends_at)-new Date(item.starts_at),45*60000);
  assert.equal(item.session_date,riyadhTime.formatRiyadhCalendarDate(
    riyadhTime.getRiyadhCalendarDate(new Date(item.starts_at))));
}
assert.equal(new Set(writtenRows.map(x=>x.starts_at)).size,writtenRows.length);
assert.equal(result.startDate,riyadhTime.formatRiyadhCalendarDate(riyadhTime.getRiyadhCalendarDate(new Date())));
assert.equal(result.renewalDate,riyadhTime.formatRiyadhCalendarDate(
  riyadhTime.addRiyadhCalendarMonths(riyadhTime.getRiyadhCalendarDate(new Date()),1)));
const mismatch=await simulateFirstMonthSessionPreparation({...{cohort:{...cohort,days_of_week:[1]}}});
assert.equal(mismatch.result.ok,false);
assert.equal(mismatch.writeCount,0,"Mismatched days must fail BEFORE writing sessions");
const rpcFailure=await simulateFirstMonthSessionPreparation({cohort,failSeats:true});
assert.equal(rpcFailure.result.ok,false);
assert.equal(rpcFailure.writeCount,0,"Seat-query failures must fail closed");
const writeFailure=await simulateFirstMonthSessionPreparation({cohort,failSessions:true});
assert.equal(writeFailure.result.ok,false);
console.log("PASS first-month production session generator dry-run: Riyadh dates, 45-min duration, scheduled batch upsert, idempotent conflict key, fail-closed");
