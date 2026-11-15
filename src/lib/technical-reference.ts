export function normalizePumpReference(reference: string): string {
  return reference.replace(/\D/g, "");
}

export function matchesPumpReference(model: string | null | undefined, normalizedReference: string): boolean {
  return normalizedReference.length === 10
    && normalizePumpReference(model ?? "") === normalizedReference;
}
