import { formatPlate } from "./plate";
import { readPartItems } from "./parts";
import { formatDateBR } from "./schedule";
import { formatBRL, orderStatusInfo, orderTotal, type OrderStatus } from "./status";

const SHOP = "Cleidson Diesel";
export const SHOP_PHONE = "71986571661";
export const SHOP_WHATSAPP = waLink(SHOP_PHONE, "Olá! Gostaria de falar com a Cleidson Diesel.");

/** Converte telefone brasileiro para o formato do WhatsApp (55 + DDD + número). */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const n = toWhatsAppNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function appointmentShopLink(a: { name: string; date: string; time: string; plate: string; vehicle: string; service: string }): string | null {
  return waLink(SHOP_PHONE, [
    `Olá, Cleidson Diesel! Sou ${a.name} e fiz um agendamento pelo site.`,
    `Data: ${formatDateBR(a.date)} às ${a.time.slice(0, 5)}.`,
    `Veículo: ${a.vehicle} (${formatPlate(a.plate)}).`,
    `Serviço: ${a.service}.`,
  ].join("\n"));
}

export function approvalShopLink(o: { number: number; plate: string; vehicle: string }, name: string): string | null {
  return waLink(SHOP_PHONE, [
    `Olá, Cleidson Diesel! Sou ${name} e aprovei o orçamento da OS nº ${o.number} pelo site.`,
    `Veículo: ${o.vehicle} (${formatPlate(o.plate)}).`,
  ].join("\n"));
}

type OrderLike = {
  number: number;
  plate: string;
  customer_name: string;
  vehicle: string;
  status: OrderStatus;
  complaint: string;
  diagnosis: string | null;
  parts: string | null;
  part_items?: unknown;
  parts_value: number | string;
  labor_value: number | string;
  due_date: string | null;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function statusMessage(o: OrderLike, siteUrl?: string): string {
  const info = orderStatusInfo(o.status);
  const lines = [
    `Olá, ${firstName(o.customer_name)}! Aqui é da ${SHOP}.`,
    ``,
    `Atualização da OS nº ${o.number} — ${o.vehicle} (${formatPlate(o.plate)}):`,
    `*Status: ${info.label}*`,
  ];
  if (o.status === "pronto") lines.push(``, `Seu veículo já está pronto para retirada!`);
  else if (o.due_date && o.status !== "entregue" && o.status !== "cancelado")
    lines.push(`Previsão de entrega: ${formatDateBR(o.due_date)}`);
  if (siteUrl) lines.push(``, `Acompanhe pela placa: ${siteUrl}/consulta`);
  return lines.join("\n");
}

export function quoteMessage(o: OrderLike, approvalLink?: string): string {
  const total = orderTotal(o.parts_value, o.labor_value);
  const lines = [
    `Olá, ${firstName(o.customer_name)}! Aqui é da ${SHOP}.`,
    ``,
    `*Orçamento — OS nº ${o.number}*`,
    `Veículo: ${o.vehicle} (${formatPlate(o.plate)})`,
  ];
  if (o.diagnosis) lines.push(``, `Diagnóstico: ${o.diagnosis}`);
  if (o.parts) lines.push(``, `Peças/serviços: ${o.parts}`);
  const items = readPartItems(o.part_items);
  if (items.length) lines.push(``, `*Peças:*`, ...items.map((item) => `${item.description}: ${formatBRL(item.value)}`));
  lines.push(
    ``,
    `Peças: ${formatBRL(Number(o.parts_value ?? 0))}`,
    `Mão de obra: ${formatBRL(Number(o.labor_value ?? 0))}`,
    `*Total: ${formatBRL(total)}*`,
  );
  if (o.due_date) lines.push(`Previsão de entrega: ${formatDateBR(o.due_date)}`);
  lines.push(``, approvalLink ? `Confira e aprove o orçamento pelo site: ${approvalLink}` : `Podemos seguir com o serviço? Responda *SIM* para aprovar.`);
  return lines.join("\n");
}

export function appointmentMessage(a: {
  customer_name: string;
  scheduled_date: string;
  scheduled_time: string;
  vehicle: string;
  plate: string;
}): string {
  return [
    `Olá, ${firstName(a.customer_name)}! Aqui é da ${SHOP}.`,
    ``,
    `Seu agendamento está *confirmado* para ${formatDateBR(a.scheduled_date)} às ${a.scheduled_time.slice(0, 5)}.`,
    `Veículo: ${a.vehicle} (${formatPlate(a.plate)})`,
    ``,
    `Te esperamos!`,
  ].join("\n");
}
