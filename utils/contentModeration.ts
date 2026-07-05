type ModerationField = {
  label: string;
  value?: string | null;
};

type ModerationResult = {
  ok: boolean;
  message?: string;
  fieldLabel?: string;
};

const BLOCKED_TERMS = [
  "amk",
  "aq",
  "amq",
  "amina",
  "amına",
  "amcik",
  "amcık",
  "amcuk",
  "orospu",
  "orosbu",
  "pic",
  "piç",
  "siktir",
  "sikerim",
  "sikeyim",
  "sikik",
  "sikis",
  "sikiş",
  "yarrak",
  "yarak",
  "got",
  "göt",
  "ibne",
  "pezevenk",
  "kahpe",
  "pust",
  "puşt",
  "surtuk",
  "sürtük",
  "gerizekali",
  "gerizekalı",
  "aptal",
  "salak",
  "haysiyetsiz",
  "serefsiz",
  "şerefsiz",
];

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "!": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  "$": "s",
  "7": "t",
};

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .replace(/[0134@5$7!]/g, (char) => LEET_MAP[char] || char)
    .replace(/\bq\b/g, "k")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function compactText(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export const CONTENT_MODERATION_MESSAGE =
  "Bu içerik topluluk kurallarına uygun görünmüyor. Lütfen düzenleyip tekrar deneyin.";

export function validateCleanContent(fields: ModerationField[]): ModerationResult {
  for (const field of fields) {
    const rawValue = field.value?.trim();
    if (!rawValue) continue;

    const normalized = normalizeText(rawValue).replace(/[^a-z0-9]+/g, " ");
    const compact = compactText(rawValue);

    const hasBlockedTerm = BLOCKED_TERMS.some((term) => {
      const normalizedTerm = normalizeText(term);
      const compactTerm = compactText(term);
      const termPattern = new RegExp(`(^|\\s)${normalizedTerm}(\\s|$)`);

      return termPattern.test(normalized) || compact.includes(compactTerm);
    });

    if (hasBlockedTerm) {
      return {
        ok: false,
        fieldLabel: field.label,
        message: `${field.label} alanında küfür veya hakaret içeren ifadeler var. ${CONTENT_MODERATION_MESSAGE}`,
      };
    }
  }

  return { ok: true };
}

export function isBlockedLanguageError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : String(error || "");

  return (
    message.toLocaleLowerCase("tr-TR").includes("uygunsuz içerik") ||
    message.toLocaleLowerCase("tr-TR").includes("topluluk kurallarına")
  );
}
