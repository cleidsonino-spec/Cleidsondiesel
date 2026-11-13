import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function warrantyEndDate(start: string, months: number): string {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(start) || !Number.isInteger(months) || months < 1 || months > 120) return "";
  const [year, month, day] = start.split("-").map(Number);
  if (!year || !month || !day) return "";
  const original = new Date(Date.UTC(year, month - 1, day));
  if (original.toISOString().slice(0, 10) !== start) return "";
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

export function canIssueWarranty(orderStatus: string, deliveredAt: string | null): boolean {
  return orderStatus === "entregue" && Boolean(deliveredAt);
}

export function warrantyState(start: string, end: string, today: string) {
  if (today < start) return "A iniciar";
  return today <= end ? "Vigente" : "Vencida";
}

export const warrantiesQuery = () => queryOptions({
  queryKey: ["warranties"],
  queryFn: async () => {
    const { data, error } = await supabase.from("warranties").select("*, service_orders(id, number, plate, vehicle, vehicle_year, customer_id, customer_name, phone, complaint)").order("end_date", { ascending: false });
    if (error) throw error;
    return data;
  },
});
