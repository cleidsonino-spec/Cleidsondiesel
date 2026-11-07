/**
 * Horários de atendimento da oficina.
 * Segunda a sexta: 08h às 17h (sem 12h, almoço).
 * Sábado e domingo: fechado.
 */
const WEEKDAY_SLOTS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

/** date no formato YYYY-MM-DD */
export function getSlotsForDate(date: string): string[] {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return [];
  const dow = new Date(y, m - 1, d).getDay();
  if (dow === 0 || dow === 6) return [];
  return WEEKDAY_SLOTS;
}

/** Remove horários já ocupados (aceita "08:00" ou "08:00:00"). */
export function availableSlots(date: string, booked: string[]): string[] {
  const taken = new Set(booked.map((t) => t.slice(0, 5)));
  return getSlotsForDate(date).filter((s) => !taken.has(s));
}

export function todayISO(): string {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
