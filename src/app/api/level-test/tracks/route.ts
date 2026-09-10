import { NextResponse } from "next/server";
import { tracks } from "@/lib/level-test/data";

// بيانات المسارات العامة فقط (بدون بنك الأسئلة أو الإجابات)
export async function GET() {
  const publicTracks = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.subtitle,
    description: t.description,
  }));
  return NextResponse.json({ tracks: publicTracks });
}
