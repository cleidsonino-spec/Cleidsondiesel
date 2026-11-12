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

const eventLabels: Record<string, string> = {
  created: "Ordem de serviço criada",
  status_changed: "Status alterado",
  vehicle_received: "Veículo recebido na oficina",
  diagnosis_logged: "Diagnóstico técnico registrado",
  technical_progress: "Andamento técnico registrado",
  quote_issued: "Orçamento enviado para aprovação",
  quote_approved: "Orçamento aprovado",
  quote_revoked: "Link de aprovação revogado",
  mechanic_assigned: "Mecânico atribuído à ordem",
  mechanic_unassigned: "Atribuição do mecânico encerrada ou substituída",
  service_completed: "Serviço concluído tecnicamente",
  customer_authorization: "Autorização de execução registrada",
  delivery_confirmation: "Confirmação de entrega registrada",
};

function eventTitle(event: TimelineEvent) {
  if (event.event_label?.trim()) return event.event_label;
  if (event.event_type === "status_changed" && event.new_status === "entregue") {
    return "Veículo entregue ao cliente";
  }
  if (event.event_type === "status_changed" && event.new_status === "pronto") {
    return "Serviço concluído — pronto para retirada";
  }
  return eventLabels[event.event_type] ?? "Evento da ordem de serviço";
}

function detailText(event: TimelineEvent) {
  const details = event.details ?? {};
  const parts: string[] = [];
  const add = (key: string, label: string) => {
    const value = details[key];
    if (typeof value === "string" && value.trim()) parts.push(`${label}: ${value}`);
  };

  add("description", "Descrição");
  add("procedure", "Procedimento");
  add("result", "Resultado");
  add("observations", "Observações");
  add("delivered_by_name", "Pessoa que entregou o veículo");
  add("received_by_name", "Nome informado de quem recebeu o veículo");
  add("signer_name", "Cliente/representante informado no aceite");
  add("approved_by", "Nome informado na aprovação do orçamento");
  add("odometer", "Hodômetro/horímetro");
  add("fuel_level", "Combustível");
  add("exterior_condition", "Condição externa");
  add("consent_text", "Texto do aceite");
  add("mechanic_user_id", "Mecânico da atribuição (ID)");
  add("assignment_id", "Identificação da atribuição");
  add("assigned_at", "Atribuição iniciada em");
  add("ended_at", "Atribuição encerrada em");
  add("completed_at", "Conclusão técnica em");
  add("state", "Situação do orçamento");

  if (typeof details.active === "boolean") {
    parts.push(details.active ? "Atribuição ativa" : "Atribuição encerrada");
  }
  if (typeof details.authorization_type === "string") {
    parts.push(details.authorization_type === "delivery_confirmation"
      ? "Tipo: confirmação de entrega"
      : "Tipo: autorização de execução");
  }
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
        .order("changed_at", { ascending: false })
        .order("id", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
  });

  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold"><History className="size-4" /> Histórico completo da OS</h2>
      <p className="text-xs text-muted-foreground">Linha do tempo de recebimento, diagnóstico, orçamento, atribuições, execução, autorizações, conclusão técnica e entrega física. Eventos anteriores à ativação dos registros integrados não são reconstruídos.</p>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p>
        : query.isError ? <p className="text-sm text-destructive">Não foi possível carregar o histórico da ordem.</p>
        : query.data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda. A linha do tempo começa após a instalação das atualizações no banco.</p>
        : <ol className="space-y-4">
          {query.data.map((event) => {
            const isStatus = event.event_type === "created" || event.event_type === "status_changed";
            const current = orderStatusInfo(event.new_status as never);
            const previous = event.previous_status ? orderStatusInfo(event.previous_status as never) : null;
            const details = detailText(event);
            const changedAt = new Date(event.changed_at);
            return <li key={event.id} className="relative border-l-2 border-border pl-4">
              <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary" />
              <p className="text-sm font-semibold">{eventTitle(event)}</p>
              {isStatus && <p className="text-sm">{previous ? `${previous.label} → ${current.label}` : current.label}</p>}
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{Number.isNaN(changedAt.getTime()) ? "Horário não disponível" : changedAt.toLocaleString("pt-BR")}</p>
              {event.actor_name && <p className="text-xs text-muted-foreground">Nome informado no registro: {event.actor_name}</p>}
              <p className="text-xs text-muted-foreground">{event.changed_by ? `Usuário autenticado da equipe (ID): ${event.changed_by}` : "Usuário autenticado da equipe não identificado neste evento"}</p>
              {details.length > 0 && <div className="mt-2 space-y-1 rounded bg-muted/50 p-2">{details.map((detail, index) => <p key={index} className="whitespace-pre-wrap text-xs text-muted-foreground">{detail}</p>)}</div>}
            </li>;
          })}
        </ol>}
    </section>
  );
}
