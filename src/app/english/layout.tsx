import { notFound } from "next/navigation";
import { areUnfinishedRoutesEnabled } from "@/lib/unfinished-routes";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  if (!areUnfinishedRoutesEnabled()) notFound();
  return children;
}
