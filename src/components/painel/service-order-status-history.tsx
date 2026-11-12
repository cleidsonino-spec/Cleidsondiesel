import { useQuery } from "@tanstack/react-query";
import { Clock3, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { orderStatusInfo } from "@/lib/status";

type StatusEvent = {
  id: string;
  previous_status: string | null;
  new_status: string;
  event_type: "created" | "status_changed";
  changed_at: string;
  changed_by: string | null;
};

export function ServiceOrderStatusHistory({ orderId }: { orderId: string }) {
  const query = useQuery({
    queryKey: ["service-order-status-history", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_order_status_events")
        .select("id,previous_status,new_status,event_type,changed_at,changed_by")
        .eq("service_order_id", orderId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StatusEvent[];
    },
  });

  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold"><History className="size-4" /> Histórico de status da OS</h2>
      <p className="text-xs text-muted-foreground">Registra a criação da OS e cada mudança de status a partir da ativação deste histórico. Não altera nem reconstrói eventos anteriores.</p>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p>
        : query.isError ? <p className="text-sm text-destructive">Não foi possível carregar o histórico de status.</p>
        : query.data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda. O histórico começa após a instalação da atualização no banco.</p>
        : <ol className="space-y-3">
          {query.data.map((event) => {
            const current = orderStatusInfo(event.new_status as never);
            const previous = event.previous_status ? orderStatusInfo(event.previous_status as never) : null;
            return <li key={event.id} className="relative border-l-2 border-border pl-4">
              <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary" />
              <p className="text-sm font-medium">{event.event_type === "created" ? "OS criada" : "Status alterado"}</p>
              <p className="text-sm">{previous ? `${previous.label} → ${current.label}` : current.label}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{new Date(event.changed_at).toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">{event.changed_by ? `Usuário responsável: ${event.changed_by}` : "Responsável não identificado pela sessão"}</p>
            </li>;
          })}
        </ol>}
    </section>
  );
}
