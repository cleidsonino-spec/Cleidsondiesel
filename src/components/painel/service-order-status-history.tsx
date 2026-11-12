import { useQuery } from "@tanstack/react-query";
import { Clock3, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { orderStatusInfo } from "@/lib/status";

type TimelineEvent = {
  id: string;
  previous_status: string | null;
  new_status: string;
  event_type: string;
  event_label: string | null;
  changed_at: string;
  changed_by: string | null;
  actor_name: string | null;
  details: Record<string, unknown> | null;
};

function detailText(event: TimelineEvent) {
  const details = event.details ?? {};
  const parts: string[] = [];
  if (typeof details.description === "string" && details.description.trim()) parts.push(details.description);
  if (typeof details.delivered_by_name === "string" && details.delivered_by_name.trim()) parts.push(`Entregue por: ${details.delivered_by_name}`);
  if (typeof details.odometer === "string" && details.odometer.trim()) parts.push(`Hodômetro/horímetro: ${details.odometer}`);
  if (typeof details.fuel_level === "string" && details.fuel_level.trim()) parts.push(`Combustível: ${details.fuel_level.replace("_", " ")}`);
  if (typeof details.exterior_condition === "string" && details.exterior_condition.trim()) parts.push(`Condição: ${details.exterior_condition}`);
  if (typeof details.consent_text === "string" && details.consent_text.trim()) parts.push(details.consent_text);
  if (typeof details.mechanic_user_id === "string") parts.push(`Mecânico vinculado: ${details.mechanic_user_id}`);
  return parts;
}

export function ServiceOrderStatusHistory({ orderId }: { orderId: string }) {
  const query = useQuery({
    queryKey: ["service-order-status-history", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_order_status_events")
        .select("id,previous_status,new_status,event_type,event_label,changed_at,changed_by,actor_name,details")
        .eq("service_order_id", orderId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
  });

  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold"><History className="size-4" /> Histórico completo da OS</h2>
      <p className="text-xs text-muted-foreground">Linha do tempo de status, recebimento, diagnóstico, orçamento, atribuições, execução, autorizações e conclusão. Eventos anteriores à ativação dos registros integrados não são reconstruídos.</p>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p>
        : query.isError ? <p className="text-sm text-destructive">Não foi possível carregar o histórico da ordem.</p>
        : query.data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda. A linha do tempo começa após a instalação das atualizações no banco.</p>
        : <ol className="space-y-4">
          {query.data.map((event) => {
            const isStatus = event.event_type === "created" || event.event_type === "status_changed";
            const current = orderStatusInfo(event.new_status as never);
            const previous = event.previous_status ? orderStatusInfo(event.previous_status as never) : null;
            const details = detailText(event);
            return <li key={event.id} className="relative border-l-2 border-border pl-4">
              <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary" />
              <p className="text-sm font-semibold">{event.event_label || (event.event_type === "created" ? "OS criada" : event.event_type === "status_changed" ? "Status alterado" : "Evento da ordem")}</p>
              {isStatus && <p className="text-sm">{previous ? `${previous.label} → ${current.label}` : current.label}</p>}
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{new Date(event.changed_at).toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">{event.actor_name ? `Registrado por: ${event.actor_name}` : event.changed_by ? `Usuário responsável: ${event.changed_by}` : "Responsável não identificado pela sessão"}</p>
              {details.length > 0 && <div className="mt-2 space-y-1 rounded bg-muted/50 p-2">{details.map((detail, index) => <p key={index} className="whitespace-pre-wrap text-xs text-muted-foreground">{detail}</p>)}</div>}
            </li>;
          })}
        </ol>}
    </section>
  );
}
