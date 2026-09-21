export function normalizeParentEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Postgres ILIKE treats %, _, and backslash as pattern syntax. Escaping all three
// keeps the comparison exact while remaining case-insensitive.
export function exactParentEmailPattern(email: string): string {
  return normalizeParentEmail(email).replace(/[\\%_]/g, (character) => `\\${character}`);
}