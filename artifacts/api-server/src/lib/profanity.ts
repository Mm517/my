import { Filter } from "bad-words";

const filter = new Filter();

// Curated Arabic banned-word list. Keep this conservative but cover the most
// common insults, slurs and explicit terms that the community wants flagged
// for admin review. Each entry is normalized (no diacritics, single spelling
// variant). Admin can grow this list over time without code changes via the
// admin moderation queue (filtered=true messages surface there).
const arabicBadWords = [
  // General insults
  "كلب",
  "كلبه",
  "كلاب",
  "حمار",
  "حماره",
  "حمير",
  "بهيم",
  "بهيمه",
  "غبي",
  "غبيه",
  "اغبياء",
  "احمق",
  "أحمق",
  "حمقاء",
  "اهبل",
  "هبيل",
  "معتوه",
  "مغفل",
  "تافه",
  "تافهه",
  "حقير",
  "حقيره",
  "قذر",
  "قذره",
  "وسخ",
  "وسخه",
  "نجس",
  "نجسه",
  "خنزير",
  "خنزيره",
  "خنازير",
  "حيوان",
  "حيوانات",
  "بقره",
  "ثور",
  // Strong curses
  "خرا",
  "خراء",
  "زفت",
  "زباله",
  "تبا",
  "تباً",
  "لعنه",
  "لعنة",
  "ملعون",
  "ملعونه",
  // Family insults
  "ابن كلب",
  "ابن الكلب",
  "ابن حرام",
  "ابن الحرام",
  "ابن العاهره",
  "ابن العاهرة",
  // Sexual / explicit
  "عاهره",
  "عاهرة",
  "شرموطه",
  "شرموطة",
  "شراميط",
  "قحبه",
  "قحبة",
  "زاني",
  "زانيه",
  "زانية",
  "منيوك",
  "منيوكه",
  "كس",
  "زب",
  "طيز",
  "طياز",
  "نيك",
  "نياكه",
  "ينيك",
  "اغتصاب",
  "متناك",
  "متناكه",
  "خول",
  "خوال",
  "لوطي",
  "شاذ",
  "مخنث",
  // Sectarian / hate (keep blocked)
  "كافر",
  "كفره",
  "زنديق",
  "مرتد",
  "يهودي قذر",
  "صهيوني قذر",
];

// Common transliterations / leet variants used to bypass the filter.
const englishExtraBadWords = [
  "kos",
  "kosak",
  "ya kalb",
  "ibn kalb",
  "khara",
  "sharmota",
  "sharmoota",
  "manyak",
  "manyouk",
  "zeb",
  "tiz",
  "neek",
  "n3eek",
  "ne3k",
  "kalb",
  "7mar",
  "7omar",
  "ahbal",
  "a7bal",
];

try {
  filter.addWords(...arabicBadWords, ...englishExtraBadWords);
} catch {
  /* ignore */
}

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  try {
    return filter.isProfane(text);
  } catch {
    return false;
  }
}

export function cleanProfanity(text: string): string {
  if (!text) return text;
  try {
    return filter.clean(text);
  } catch {
    return text;
  }
}
