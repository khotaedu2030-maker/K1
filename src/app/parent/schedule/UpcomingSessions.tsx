"use client";

import { useState } from "react";
import { formatSessionDay, formatSessionDate, formatSessionTime, toParentFacingProgramName, sessionStatusLabelAr } from "@/lib/arabic-time";

export type SessionRow = {
  id: string;
  startsAt: string;
  programTitle: string | null;
  childName: string | null;
  status: string;
};

const VISIBLE_COUNT = 4;

export default function UpcomingSessions({ sessions }: { sessions: SessionRow[] }) {
  const [expanded, setExpanded] = useState(false);

  if (sessions.length === 0) {
    return (
      <div className="dashcard">
        <b>الجلسات القادمة</b>
        <p style={{ color: "var(--gray)", marginTop: 8 }}>لا توجد جلسات قادمة حاليًا.</p>
        <p style={{ color: "var(--gray)", fontSize: 13 }}>سنظهر مواعيدك هنا فور جدولتها.</p>
      </div>
    );
  }

  const visible = expanded ? sessions : sessions.slice(0, VISIBLE_COUNT);

  return (
    <div className="dashcard">
      <b>الجلسات القادمة</b>
      <div className="session-timeline" style={{ marginTop: 14 }}>
        {visible.map((s) => (
          <div className="session-timeline-item" key={s.id}>
            <b>{formatSessionDay(s.startsAt)} {formatSessionDate(s.startsAt)}</b>
            <p style={{ margin: "4px 0 0", color: "var(--gray)" }}>
              {formatSessionTime(s.startsAt)} • {toParentFacingProgramName(s.programTitle)}
              {s.childName ? ` • ${s.childName}` : ""}
              {s.status !== "scheduled" ? ` • ${sessionStatusLabelAr(s.status)}` : ""}
            </p>
          </div>
        ))}
      </div>
      {sessions.length > VISIBLE_COUNT && (
        <button className="btn small outline" onClick={() => setExpanded((v) => !v)} style={{ marginTop: 10 }}>
          {expanded ? "عرض أقل" : "عرض جميع الجلسات"}
        </button>
      )}
    </div>
  );
}
