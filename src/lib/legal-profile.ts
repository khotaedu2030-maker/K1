// مصدر واحد لبيانات مقدّم الخدمة — تُستخدَم في كل الصفحات النظامية (الشروط، الخصوصية،
// الاسترجاع، الشكاوى، بيانات مقدّم الخدمة) بدل تكرارها. القيم غير المؤكَّدة تبقى null صراحةً؛
// لا تُعرَض placeholders ("ضع الرقم هنا") للمستخدم — الحقول الفارغة تُخفى ببساطة من الواجهة.
// حدِّث هذا الملف فقط بعد تأكيد القيم الفعلية من مالك خُطى — راجع قسم "بيانات ناقصة" بالتقرير.

export type LegalProfile = {
  brandName: string;
  providerName: string | null;
  registrationType: "وثيقة عمل حر" | "سجل تجاري" | null;
  registrationNumber: string | null;
  businessAddress: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  country: string;
  vatNumber: string | null;
  lastLegalUpdate: string;
};

export const legalProfile: LegalProfile = {
  brandName: "خُطى | KHOTA",
  providerName: null,
  registrationType: "وثيقة عمل حر",
  registrationNumber: null,
  businessAddress: null,
  supportEmail: null,
  supportPhone: null,
  country: "المملكة العربية السعودية",
  vatNumber: null,
  lastLegalUpdate: "2026-09-15",
};
