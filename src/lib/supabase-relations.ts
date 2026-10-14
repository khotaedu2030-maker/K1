export type SupabaseRelation<T> = T | T[] | null | undefined;

export function supabaseRelationOne<T>(relation: SupabaseRelation<T>): T | undefined {
  if (relation == null) return undefined;
  return Array.isArray(relation) ? relation[0] : relation;
}