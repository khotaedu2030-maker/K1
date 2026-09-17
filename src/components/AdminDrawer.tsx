"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function AdminDrawer({
  open,
  onClose,
  title,
  loading,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-drawer-root">
      <div className="admin-drawer-overlay" onClick={onClose} />
      <div
        className="admin-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="admin-drawer-head">
          <b>{title}</b>
          <button className="admin-drawer-close" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
        <div className="admin-drawer-body">
          {loading && <p style={{ color: "var(--gray)" }}>جارٍ التحميل...</p>}
          {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
          {!loading && !error && children}
        </div>
      </div>
    </div>
  );
}
