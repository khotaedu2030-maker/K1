// Test-only harness: executes the actual private production first-month session
// preparation function using a mocked Supabase client with NO network or writes.
// This never calls any payment, activation, or billing method.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(p)=>fs.readFileSync(path.join(ROOT,p),"utf8");
const ts=createRequire(path.join(ROOT,"package.json"))("typescript");
function evaluate(tsCode, dependencies={}) {
  const moduleRecord={exports:{}};
  const js=ts.transpileModule(tsCode,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,
  }}).outputText;
  const context={module:moduleRecord,exports:moduleRecord.exports,
    Intl,Date,String,Number,Math,Set,Map,Array,Object,
    require:(name)=>{
      if(name==="server-only")return {};
      if(Object.prototype.hasOwnProperty.call(dependencies,name))return dependencies[name];
      throw new Error("Unrecognized import in QA isolated transpilation: "+name);
    },
  };
  vm.runInNewContext(js,context,{timeout:12000});
  return moduleRecord.exports;
}
const riyadh=evaluate(read("src/lib/riyadh-time.ts"));
const activationSource=read("src/lib/activate-subscription.ts")+
  "\nexport { prepareSessionsForActivation as qaPrepareSessionsForActivation };\n";
const activation=evaluate(activationSource,{"@/lib/riyadh-time":riyadh,"@/lib/supabase-admin":{}});
const arabic=evaluate(read("src/lib/arabic-time.ts"));
export const riyadhTime=riyadh;
export const formatFirstSessionTime=arabic.formatSessionTime;
export const formatFirstSessionDay=arabic.formatSessionDay;
export const formatFirstSessionDate=arabic.formatSessionDate;

export async function simulateFirstMonthSessionPreparation({
  plan={price_sar:399,days_per_week:2},
  cohort,
  seatsAvailable=2,
  failSeats=false,
  failSessions=false,
}) {
  if(!cohort || !cohort.id)throw new Error("Only explicit, synthetic cohort configuration allowed");
  let writtenRows=[];
  let callOptions=null;
  let writeCount=0;
  function rowQuery(data) {
    return {select(){return this;},eq(){return this;},
      async single(){return {data,error:null};}};
  }
  const client={
    from(name){
      if(name==="plans")return rowQuery(plan);
      if(name==="cohorts")return rowQuery(cohort);
      if(name==="sessions")return {async upsert(rows,options){
        writeCount++;
        writtenRows=rows;
        callOptions=options;
        return {error:failSessions?{message:"synthetic session write rejected"}:null};
      }};
      throw new Error("Unexpected QA mocked DB table: "+name);
    },
    async rpc(name){
      if(name!=="cohort_available_seats")throw new Error("Unexpected mocked RPC: "+name);
      return {data:seatsAvailable,error:failSeats?{message:"synthetic seat lookup failed"}:null};
    },
  };
  const result=await activation.qaPrepareSessionsForActivation(client,{
    id:"synthetic-subscription-only",
    plan_id:"synthetic-plan-only",
    cohort_id:cohort.id,
  });
  return {result,writtenRows,callOptions,writeCount};
}
