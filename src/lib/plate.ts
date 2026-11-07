/** Remove tudo que não é letra/número e coloca em maiúsculas. */
export function normalizePlate(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Aceita placa antiga (ABC1234) e Mercosul (ABC1D23). */
export function isValidPlate(value: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlate(value));
}

/** Formata para exibição: ABC-1234 (antiga) ou ABC1D23 (Mercosul). */
export function formatPlate(value: string): string {
  const p = normalizePlate(value);
  if (/^[A-Z]{3}[0-9]{4}$/.test(p)) return `${p.slice(0, 3)}-${p.slice(3)}`;
  return p;
}
