import { isTeamsMeetingUrl } from "@/lib/teaching-readiness";

// A new tab must be created synchronously during the click. Opening it only
// after awaiting attendance confirmation is blocked as a popup on some devices.
type BrowserForJoin = Pick<Window, "open" | "location">;
export type PendingMeetingTab = Window | null;

export function beginMeetingJoin(browser: BrowserForJoin): PendingMeetingTab {
  const tab = browser.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  return tab;
}

export function cancelMeetingJoin(tab: PendingMeetingTab): void {
  if (tab && !tab.closed) tab.close();
}

export type MeetingJoinResult = "opened" | "invalid" | "closed";

export function finishMeetingJoin(
  browser: BrowserForJoin,
  tab: PendingMeetingTab,
  meetingUrl: unknown,
): MeetingJoinResult {
  if (typeof meetingUrl !== "string" || !isTeamsMeetingUrl(meetingUrl)) {
    cancelMeetingJoin(tab);
    return "invalid";
  }

  // An explicit user close is respected; don't unexpectedly navigate away.
  if (tab?.closed) return "closed";

  if (tab) {
    tab.location.replace(meetingUrl);
  } else {
    // Popup blocked: use the current tab, never silently report success.
    browser.location.assign(meetingUrl);
  }
  return "opened";
}
