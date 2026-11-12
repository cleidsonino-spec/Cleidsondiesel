import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ClipboardList, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { readPartItems } from "@/lib/parts";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { formatBRL, orderStatusInfo, orderTotal } from "@/lib/status";
import { warrantyState } from "@/lib/warranty";

type ServiceOrder = Database["public"]["Tables"]["service_orders"]["Row"];
type Warranty = Database["public"]["Tables"]["warranties"]["Row"];

async function fetchVehicleHistory(vehicleId: string | null, plate: string) {
  const allOrders: ServiceOrder[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let request = supabase.from("service_orders").select("*");
    request = vehicleId
      ? request.or(`vehicle_id.eq.${vehicleId},plate.eq.${plate}`)
      : request.eq("plate", plate);
    const { data, error } = await request
      .order("entry_date", { ascending: false })
      .order("number", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    allOrders.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const ids = allOrders.map((order) => order.id);
  let warranties: Warranty[] = [];
  if (ids.length) {
    const { data, error } = await supabase.from("warranties").select("*").in("service_order_id", ids);
    if (error) throw error;
    warranties = data ?? [];
  }
  return { orders: allOrders, warranties };
}

export function VehicleHistory({ order }: { order: Pick<ServiceOrder, "id" | "vehicle_id" | "plate"> }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vehicle-history", order.vehicle_id, order.plate],
    queryFn: () => fetchVehicleHistory(order.vehicle_id, order.plate),
    staleTime: 30_000,
  });

  if (isLoading) return <section className="border-t border-border pt-6"><p className="text-sm text-muted-foreground">Carregando histórico do veículo...</p></section>;
  if (isError || !data) return <section className="border-t border-border pt-6"><p className="text-sm text-destructive">Não foi possível carregar o histórico deste veículo.</p></section>;

  const { orders, warranties } = data;
  return (
    <section className="space-y-4 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="size-5 text-primary" />
        <div>
          <h2 className="text-xl">Histórico completo do veículo</h2>
          <p className="text-sm text-muted-foreground">{orders.length} ordem(ns) de serviço localizada(s) pela placa e pelo cadastro do veículo.</p>
        </div>
      </div>
      {orders.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há serviços anteriores registrados para este veículo.</p> : (
        <ol className="space-y-4">
          {orders.map((item) => {
            const info = orderStatusInfo(item.status);
            const itemWarranties = warranties.filter((w) => w.service_order_id === item.id);
            const parts = readPartItems(item.part_items);
            return (
              <li key={item.id} className="relative rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">OS nº {item.number}{item.id === order.id ? " · Ordem atual" : ""}</p>
                    <p className="font-semibold">{formatDateBR(item.entry_date)} · {item.vehicle}</p>
                    <p className="text-sm text-muted-foreground">{item.customer_name} · {item.plate}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{info.label}</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><p className="text-xs font-semibold uppercase text-muted-foreground">Serviço solicitado</p><p className="whitespace-pre-wrap text-sm">{item.complaint || "—"}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-muted-foreground">Diagnóstico</p><p className="whitespace-pre-wrap text-sm">{item.diagnosis || "Ainda não registrado"}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-muted-foreground">Peças e serviços</p><p className="whitespace-pre-wrap text-sm">{item.parts || parts.map((part) => part.description).join(", ") || "—"}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-muted-foreground">Total registrado na OS</p><p className="text-sm font-semibold">{formatBRL(orderTotal(item.parts_value, item.labor_value))}</p></div>
                </div>
                {itemWarranties.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-md bg-secondary/50 p-3">
                    {itemWarranties.map((warranty) => (
                      <div key={warranty.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                        <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 text-primary" /><div><p className="font-medium">Garantia · {warranty.duration_months} meses · {warrantyState(warranty.start_date, warranty.end_date, todayISO())}</p><p className="text-muted-foreground">{warranty.coverage}</p><p className="text-xs text-muted-foreground">{formatDateBR(warranty.start_date)} a {formatDateBR(warranty.end_date)}</p></div></div>
                        <Link to="/painel/garantias/$id" params={{ id: warranty.id }} className="text-primary hover:underline">Ver certificado</Link>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" /> Previsão: {formatDateBR(item.due_date)}</span>
                  <Link to="/painel/ordens/$id" params={{ id: item.id }} className="text-sm text-primary hover:underline">Abrir OS</Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
