import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

export const ORDER_STATUSES: { value: OrderStatus; label: string; tone: Tone }[] = [
  { value: "recebido", label: "Recebido", tone: "info" },
  { value: "em_analise", label: "Em análise", tone: "warning" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação", tone: "warning" },
  { value: "em_servico", label: "Em serviço", tone: "primary" },
  { value: "pronto", label: "Pronto p/ retirada", tone: "success" },
  { value: "entregue", label: "Entregue", tone: "muted" },
  { value: "cancelado", label: "Cancelado", tone: "destructive" },
];

export const APPOINTMENT_STATUSES: { value: AppointmentStatus; label: string; tone: Tone }[] = [
  { value: "pendente", label: "Pendente", tone: "warning" },
  { value: "confirmado", label: "Confirmado", tone: "success" },
  { value: "concluido", label: "Concluído", tone: "muted" },
  { value: "cancelado", label: "Cancelado", tone: "destructive" },
];

export type Tone = "info" | "warning" | "primary" | "success" | "muted" | "destructive";

/** Etapas mostradas na linha do tempo para o cliente. */
export const ORDER_PROGRESS: OrderStatus[] = [
  "recebido",
  "em_analise",
  "aguardando_aprovacao",
  "em_servico",
  "pronto",
  "entregue",
];

export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  "recebido",
  "em_analise",
  "aguardando_aprovacao",
  "em_servico",
  "pronto",
];

export function orderStatusInfo(s: OrderStatus) {
  return ORDER_STATUSES.find((x) => x.value === s) ?? ORDER_STATUSES[0]!;
}

export function appointmentStatusInfo(s: AppointmentStatus) {
  return APPOINTMENT_STATUSES.find((x) => x.value === s) ?? APPOINTMENT_STATUSES[0]!;
}

export function orderTotal(parts: number | string | null, labor: number | string | null): number {
  return Number(parts ?? 0) + Number(labor ?? 0);
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
