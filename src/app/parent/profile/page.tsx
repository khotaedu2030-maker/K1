import { redirect } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { toSaudiLocalPhone } from "@/lib/phone";
import ProfileForm from "./ProfileForm";

export default async function ParentProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/parent/profile")}`);
  const { data: parent } = await supabase.from("parents").select("full_name, phone").eq("user_id", user.id).maybeSingle();
  if (!parent) return <Shell><main className="section"><div className="narrow"><h1 className="title" style={{ fontSize: 32 }}>بيانات الحساب</h1><p className="lead">أكمل تسجيل طفل أولًا لإنشاء ملف ولي الأمر.</p><Link className="btn" href="/motabaa/plans">استعراض الخطط ←</Link></div></main></Shell>;
  return <Shell><main className="section"><div className="narrow"><span className="eyebrow">لوحة ولي الأمر</span><h1 className="title" style={{ fontSize: 34 }}>بيانات الحساب</h1><ProfileForm initialName={parent.full_name ?? ""} initialPhone={toSaudiLocalPhone(parent.phone)} email={user.email ?? ""} /></div></main></Shell>;
}
