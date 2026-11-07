export function isFullName(name: string): boolean {
  const normalized = name.trim().replace(/\s+/g, " ");
  return normalized.length <= 120 && /^[\p{L}][\p{L}'-]+(?: [\p{L}][\p{L}'-]+)+$/u.test(normalized);
}

/** Validates check digits, not CPF ownership or Receita Federal registration. */
export function isValidCpf(cpf: string): boolean {
  if (!/^[\d. -]+$/.test(cpf)) return false;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(digits[length])) return false;
  }
  return true;
}

export function formatCpf(cpf: string): string {
  return cpf.replace(/\D/g, "").slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}