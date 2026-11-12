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
type PaymentHistory = { id: string; service_order_id: string; amount: number; payment_method: string; paid_at: string };
type MovementHistory = { id: string; service_order_id: string | null; item_id: string; movement_type: string; quantity: number; created_at: string; notes: string | null };
type SignatureHistory = { id: string; service_order_id: string; event_type: string; signer_name: string; signer_relation: string; signed_at: string };

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
  const payments: PaymentHistory[] = [];
  const movements: MovementHistory[] = [];
  const signatures: SignatureHistory[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const [paymentResult, movementResult, signatureResult] = await Promise.all([
      (supabase as any).from("service_order_payments")
        .select("id,service_order_id,amount,payment_method,paid_at")
        .in("service_order_id", batch),
      (supabase as any).from("inventory_movements")
        .select("id,service_order_id,item_id,movement_type,quantity,created_at,notes")
        .in("service_order_id", batch),
      (supabase as any).from("service_order_signatures")
        .select("id,service_order_id,event_type,signer_name,signer_relation,signed_at")
        .in("service_order_id", batch),
    ]);
    if (paymentResult.error) throw paymentResult.error;
    if (movementResult.error) throw movementResult.error;
    if (signatureResult.error) throw signatureResult.error;
    payments.push(...((paymentResult.data ?? []) as PaymentHistory[]));
    movements.push(...((movementResult.data ?? []) as MovementHistory[]));
    signatures.push(...((signatureResult.data ?? []) as SignatureHistory[]));
  }

  const itemIds = [...new Set(movements.map((movement) => movement.item_id))];
  const itemNames = new Map<string, string>();
  for (let start = 0; start < itemIds.length; start += 100) {
    const batch = itemIds.slice(start, start + 100);
    const { data, error } = await (supabase as any).from("inventory_items").select("id,name").in("id", batch);
    if (error) throw error;
    for (const item of data ?? []) itemNames.set(item.id, item.name);
  }

  return { orders: allOrders, warranties, payments, movements, signatures, itemNames };
}

export function VehicleHistory({ order }: { order: Pick<ServiceOrder, "id" | "vehicle_id" | "plate"> }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vehicle-history", order.vehicle_id, order.plate],
    queryFn: () => fetchVehicleHistory(order.vehicle_id, order.plate),
    staleTime: 30_000,
  });

  if (isLoading) return <section className="border-t border-border pt-6"><p className="text-sm text-muted-foreground">Carregando histórico do veículo...</p></section>;
  if (isError || !data) return <section className="border-t border-border pt-6"><p className="text-sm text-destructive">Não foi possível carregar o histórico deste veículo.</p></section>;

  const { orders, warranties, payments, movements, signatures, itemNames } = data;
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
            const itemPayments = payments.filter((payment) => payment.service_order_id === item.id);
            const itemMovements = movements.filter((movement) => movement.service_order_id === item.id);
            const itemSignatures = signatures.filter((signature) => signature.service_order_id === item.id);
            const receipt = (item as any).vehicle_receipt as Record<string, string | null> | null;
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
                {receipt && Object.values(receipt).some(Boolean) && (
                  <div className="mt-3 rounded-md border border-border p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Recebimento do veículo</p>
                    <p className="mt-1 text-sm">Data: {receipt.received_at ? new Date(receipt.received_at).toLocaleString("pt-BR") : "—"} · Responsável: {receipt.received_by || "—"}</p>
                    <p className="text-sm">Hodômetro/horímetro: {receipt.odometer || "—"} · Combustível: {receipt.fuel_level || "—"}</p>
                    {receipt.damages && <p className="mt-1 whitespace-pre-wrap text-sm">Avarias: {receipt.damages}</p>}
                    {receipt.observations && <p className="mt-1 whitespace-pre-wrap text-sm">Observações: {receipt.observations}</p>}
                  </div>
                )}
                {itemPayments.length > 0 && (
                  <div className="mt-3 rounded-md border border-border p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Recebimentos registrados</p>
                    {itemPayments.map((payment) => <p key={payment.id} className="mt-1 text-sm">{formatBRL(Number(payment.amount))} · {payment.payment_method} · {new Date(payment.paid_at).toLocaleString("pt-BR")}</p>)}
                  </div>
                )}
                {itemMovements.length > 0 && (
                  <div className="mt-3 rounded-md border border-border p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Movimentações de estoque vinculadas</p>
                    {itemMovements.map((movement) => <p key={movement.id} className="mt-1 text-sm">{movement.movement_type === "entrada" ? "Entrada" : "Saída"} · {itemNames.get(movement.item_id) || "Peça"} · {movement.quantity} · {new Date(movement.created_at).toLocaleString("pt-BR")}{movement.notes ? ` · ${movement.notes}` : ""}</p>)}
                  </div>
                )}
                {itemSignatures.length > 0 && (
                  <div className="mt-3 rounded-md border border-border p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Assinaturas registradas</p>
                    {itemSignatures.map((signature) => <p key={signature.id} className="mt-1 text-sm">{signature.event_type === "vehicle_receipt" ? "Recebimento" : "Entrega"} · {signature.signer_name} ({signature.signer_relation}) · {new Date(signature.signed_at).toLocaleString("pt-BR")}</p>)}
                  </div>
                )}
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
