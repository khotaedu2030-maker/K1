"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ActivateTrialForm({subscriptionId,disabled}:{subscriptionId:string;disabled:boolean}) {
  const router=useRouter();
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null);
  async function activate(){
    if (busy || disabled || reason.trim().length<20 || reason.trim().length>500) return;
    setBusy(true);
    setNotice(null);
    try {
      const response=await fetch("/api/admin/pilot-activate",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({subscriptionId,reason}),
      });
      const result=await response.json();
      if(!response.ok || !result.ok) {
        setNotice({ok:false,text:result.error??"تعذّر التفعيل"});
      } else {
        setNotice({ok:true,text:result.alreadyActive?
          "هذا الاشتراك حاصل مسبقًا على تجربة مجانية.":
          "تم تفعيل التجربة دون دفع، وإنشاء جدول الجلسات وتسجيل القرار."});
        router.refresh();
      }
    }catch{
      setNotice({ok:false,text:"تعذّر إكمال الطلب. تحقق من الاتصال وأعد المحاولة."});
    }finally{setBusy(false);}
  }
  return (
    <div style={{display:"grid",gap:8,minWidth:220,maxWidth:340}}>
      <label htmlFor={"trial-"+subscriptionId}>سبب منح التجربة (20–500 حرف)</label>
      <textarea id={"trial-"+subscriptionId} rows={3} maxLength={500} value={reason}
        placeholder="مثل: مقعد ضمن تجربة خُطى المجانية المعتمدة لأول 20 طالبًا"
        onChange={(e)=>setReason(e.target.value)} disabled={busy || disabled}/>
      <button className="btn small" type="button" disabled={disabled||busy||reason.trim().length<20}
        onClick={activate}>{busy?"جارٍ الاعتماد...":"اعتماد التجربة المجانية"}</button>
      {notice && <p role="status" style={{color:notice.ok?"var(--gray)":"var(--p)",margin:0}}>{notice.text}</p>}
    </div>
  );
}
