import { redirect } from "next/navigation";
import { getTeacherIdentity } from "@/lib/require-teacher";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = await getTeacherIdentity();
  if (!teacher) redirect("/staff/login");
  return children;
}