"use client";

import { useEffect, useState } from "react";
import SessionJoinButton from "./SessionJoinButton";
import { formatRelativeSessionTime, formatSessionDay, formatSessionDate, formatSessionTime, toParentFacingProgramName } from "@/lib/arabic-time";

export type NextSession = {
  id: string;
  cohortId: string;
  children: { id: string; name: string }[];
  programTitle: string | null;
  startsAt: string;
  endsAt: string;
  meetingUrl: string | null;
};

export default function NextSessionCard({ session }: { session: NextSession | null }) {
  const [relativeText, setRelativeText] = useState(() => (session ? formatRelativeSessionTime(session.startsAt) : ""));

  useEffect(() => {
    if (!session) return;
    // تحديث دوري كل 30 ثانية — لا حاجة لأكثر من ذلك لنص نسبي دقّته بالدقيقة أصلًا
    const t = setInterval(() => setRelativeText(formatRelativeSessionTime(session.startsAt)), 30_000);
    return () => clearInterval(t);
  }, [session]);

  if (!session) {
    return (
      <div className="dashcard" style={{ textAlign: "center", padding: "36px 24px" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>لا توجد جلسات قادمة حاليًا.</p>
        <p style={{ color: "var(--gray)", marginTop: 6 }}>سنظهر مواعيدك هنا فور جدولتها.</p>
      </div>
    );
  }

  return (
    <div className="dashcard next-session-hero">
      <span className="badge">الجلسة القادمة</span>
      <div style={{ marginTop: 14 }}>
        <strong style={{ display: "block", fontSize: 20, fontWeight: 800 }}>
          {formatSessionDay(session.startsAt)} {formatSessionDate(session.startsAt)}
        </strong>
        <span style={{ color: "var(--gray)", fontSize: 15 }}>
          {formatSessionTime(session.startsAt)} – {formatSessionTime(session.endsAt)}
        </span>
      </div>

      <p style={{ margin: "14px 0 4px", fontWeight: 700 }}>{toParentFacingProgramName(session.programTitle)}</p>
      {session.children.length > 0 && <p style={{ margin: 0, color: "var(--gray)" }}>{session.children.map((child) => child.name).join("، ")}</p>}

      <p style={{ color: "var(--t)", fontWeight: 800, marginTop: 14 }}>{relativeText}</p>

      <div style={{ marginTop: 18 }}>
        {session.children.map((child) => (
          <div key={child.id} style={{ marginBottom: 12 }}>
            {session.children.length > 1 && <b style={{ display: "block", marginBottom: 6 }}>{child.name}</b>}
            <SessionJoinButton
              sessionId={session.id}
              childId={child.id}
              startsAt={session.startsAt}
              endsAt={session.endsAt}
              meetingUrl={session.meetingUrl}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
