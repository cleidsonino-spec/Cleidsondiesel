export function normalizePumpReference(reference: string): string {
  return reference.replace(/\D/g, "");
}

export function matchesPumpReference(model: string | null | undefined, normalizedReference: string): boolean {
  return normalizedReference.length === 10
    && normalizePumpReference(model ?? "") === normalizedReference;
}

/** Remove espaços, pontos, traços e acentos para comparar códigos com ou sem separadores. */
export function compactSearch(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Todas as palavras da busca precisam aparecer (parcial) em algum campo; também aceita o termo inteiro sem espaços. */
export function matchesTechnicalSearch(fields: Array<string | null | undefined>, query: string): boolean {
  const haystack = fields.map(compactSearch).join("|");
  const whole = compactSearch(query);
  if (!whole) return false;
  if (haystack.includes(whole)) return true;
  const words = query.split(/\s+/).map(compactSearch).filter(Boolean);
  return words.length > 1 && words.every((w) => haystack.includes(w));
}
