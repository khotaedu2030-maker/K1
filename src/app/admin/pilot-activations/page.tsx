import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { supabaseRelationOne, type SupabaseRelation } from "@/lib/supabase-relations";
import { pilotActivationEnabled } from "@/lib/pilot-activation-config";
import ActivateTrialForm from "./ActivateTrialForm";

type PendingTrial = {
  id:string;created_at:string|null;
  children:SupabaseRelation<{first_name:string|null}>;
  parents:SupabaseRelation<{full_name:string|null}>;
  cohorts:SupabaseRelation<{title:string|null;teacher_id:string|null;meeting_url:string|null}>;
};

export default async function PilotActivationAdminPage() {
  const identity=await getAdminIdentity("pilot.activate");
  if (!identity) return (
    <div className="placeholder-page">
      <div className="narrow"><span className="badge">غير مصرَّح</span></div>
    </div>
  );

  const enabled=pilotActivationEnabled();
  const admin=createSupabaseAdminClient();
  const {data,error}=enabled?await admin.from("subscriptions")
    .select("id,created_at,children(first_name),parents(full_name),cohorts(title,teacher_id,meeting_url)")
    .eq("status","pending_payment")
    .order("created_at",{ascending:true})
    .limit(50):{data:[],error:null};

  return (
    <AdminShell adminName={identity.full_name} role={identity.role}>
      <div className="admin-page-head">
        <h1>تفعيل التجربة المجانية</h1>
        <p>تفعيل إداري دون تحصيل أو تسجيل دفعة. الحد الأقصى 20 اشتراكًا، وكل عملية تُسجَّل بسببها واسم معتمدها.</p>
      </div>
      {!enabled && <p className="admin-empty-state">ميزة التفعيل مغلقة في هذه البيئة. لا يمكن اعتماد أي اشتراك هنا.</p>}
      {enabled && error && <p className="admin-empty-state">تعذّر جلب الاشتراكات. لم تُجرَ أي عملية تفعيل.</p>}
      {enabled && !error && !data?.length && <p className="admin-empty-state">لا توجد اشتراكات معلّقة للمراجعة.</p>}
      {enabled && !error && (data as PendingTrial[]|null)?.map((sub)=>{
        const child=supabaseRelationOne(sub.children);
        const parent=supabaseRelationOne(sub.parents);
        const cohort=supabaseRelationOne(sub.cohorts);
        const ready=Boolean(cohort?.teacher_id && cohort?.meeting_url);
        return (
          <div key={sub.id} className="session-row" style={{alignItems:"flex-start"}}>
            <div>
              <b>{child?.first_name??"طالب"} — {parent?.full_name??"ولي أمر"}</b>
              <p style={{margin:"4px 0",color:"var(--gray)"}}>{cohort?.title??"مجموعة غير محددة"}</p>
              <p style={{margin:"4px 0",color:ready?"var(--gray)":"var(--p)"}}>
                {ready?"يلزم التحقق من جاهزية المعلم ورابط Teams عند الاعتماد":"المجموعة لا تملك معلمًا أو رابط Teams، ولا يمكن تفعيلها"}
              </p>
            </div>
            <ActivateTrialForm subscriptionId={sub.id} disabled={!ready}/>
          </div>
        );
      })}
      {enabled && (data?.length??0)===50 && <p>يُعرض أول 50 اشتراكًا معلّقًا. قد توجد طلبات أخرى.</p>}
    </AdminShell>
  );
}
