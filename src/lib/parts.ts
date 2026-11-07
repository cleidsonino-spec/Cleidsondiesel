export type PartItem = { description: string; value: number };
export type PartDraft = { description: string; value: string };

/** Aceita reais com vírgula ou ponto decimal. */
export function parseMoney(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

export function partsTotal(items: PartItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(item.value * 100), 0) / 100;
}

export function readPartItems(value: unknown): PartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof item.description !== "string" || typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < 0) return [];
    return [{ description: item.description, value: item.value }];
  });
}

export function draftPartItems(items: PartDraft[]): PartItem[] {
  return items.filter((item) => item.description.trim() || item.value.trim()).map((item) => ({ description: item.description.trim(), value: parseMoney(item.value) }));
}