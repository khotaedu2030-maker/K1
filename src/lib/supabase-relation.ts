// PostgREST قد يمثّل علاقة many-to-one ككائن أو كمصفوفة عنصر واحد عندما لا توجد أنواع
// قاعدة مولَّدة. هذه الدالة توحّد القراءة بلا any وبلا افتراض شكل غير متحقق.
export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
