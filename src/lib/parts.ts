export type PartItem = {
  description: string;
  quantity: number;
  unit_value: number;
  value: number;
};
export type PartDraft = {
  description: string;
  quantity: string;
  unit_value: string;
};

/** Aceita reais com vírgula ou ponto decimal. */
export function parseMoney(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

export function parseQuantity(s: string): number {
  const n = Number(s.trim().replace(",", "."));
  return Number.isInteger(n) && n > 0 ? Math.min(100000, n) : 0;
}

export function lineTotal(quantity: number, unitValue: number): number {
  return Math.round(quantity * unitValue * 100) / 100;
}

export function partsTotal(items: PartItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.value * 100, 0)) / 100;
}

/** Lê também o formato antigo { description, value } sem quantidade. */
export function readPartItems(value: unknown): PartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.description !== "string") return [];
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    const unitValue = typeof item.unit_value === "number" && Number.isFinite(item.unit_value) && item.unit_value >= 0
      ? item.unit_value
      : typeof item.value === "number" && Number.isFinite(item.value) && item.value >= 0 ? item.value : 0;
    const value = typeof item.value === "number" && Number.isFinite(item.value) && item.quantity == null
      ? item.value
      : lineTotal(quantity, unitValue);
    return [{ description: item.description, quantity, unit_value: unitValue, value }];
  });
}

export function draftPartItems(items: PartDraft[]): PartItem[] {
  return items
    .filter((item) => item.description.trim() || item.unit_value.trim())
    .map((item) => {
      const quantity = parseQuantity(item.quantity);
      const unit_value = parseMoney(item.unit_value);
      return { description: item.description.trim(), quantity, unit_value, value: lineTotal(quantity, unit_value) };
    });
}
