/**
 * Saldo pendente de uma ordem, calculado em centavos para evitar
 * diferenças de ponto flutuante. Orçamentos cancelados não geram recebível.
 */
export function remainingOrderBalance(
  partsValue: number | string | null | undefined,
  laborValue: number | string | null | undefined,
  payments: Array<number | string | null | undefined>,
  status: string,
): number {
  if (status === "cancelado") return 0;
  const cents = (value: number | string | null | undefined) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  };
  const totalCents = Math.max(0, cents(partsValue) + cents(laborValue));
  const paidCents = payments.reduce((sum, value) => sum + Math.max(0, cents(value)), 0);
  return Math.max(0, totalCents - paidCents) / 100;
}
