// A query-param child ID must be verified against the current parent's child rows.
export function resolveOwnedChild<T extends { id: string }>(ownedChildren: readonly T[], requestedId: string | null | undefined): T | null {
  if (requestedId) return ownedChildren.find((child) => child.id === requestedId) ?? null;
  return ownedChildren[0] ?? null;
}
