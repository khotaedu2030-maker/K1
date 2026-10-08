import Link from "next/link";

export default function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="empty-state" role="status">
      <span className="step-motif empty-state-motif" aria-hidden="true"><span /><span /><span /><span /></span>
      <h2 className="empty-state-title">{title}</h2>
      {description && <p className="empty-state-text">{description}</p>}
      {actionHref && actionLabel && <Link className="btn" href={actionHref}>{actionLabel}</Link>}
    </div>
  );
}
