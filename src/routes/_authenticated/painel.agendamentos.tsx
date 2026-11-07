import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ClipboardPlus, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/site/status-badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatPlate } from "@/lib/plate";
import { appointmentsQuery } from "@/lib/queries";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { appointmentStatusInfo, type AppointmentStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { appointmentMessage, waLink } from "@/lib/whatsapp";

type Appointment = Database["public"]["Tables"]["appointments"]["Row"];

export const Route = createFileRoute("/_authenticated/painel/agendamentos")({
  head: () => ({ meta: [
    { title: "Agendamentos da oficina — Cleidson Diesel" },
    { name: "description", content: "Gerencie os agendamentos recebidos pela Cleidson Diesel." },
    { property: "og:title", content: "Agendamentos da oficina — Cleidson Diesel" },
    { property: "og:description", content: "Agenda de atendimento da oficina Cleidson Diesel." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(appointmentsQuery()),
  component: AgendamentosPage,
});

type View = "proximos" | "pendentes" | "todos";

function AgendamentosPage() {
  const { data } = useSuspenseQuery(appointmentsQuery());
  const [view, setView] = useState<View>("proximos");
  const today = todayISO();

  const list = data
    .filter((a) => {
      if (view === "pendentes") return a.status === "pendente";
      if (view === "proximos") return a.scheduled_date >= today && a.status !== "cancelado" && a.status !== "concluido";
      return true;
    })
    .sort((a, b) =>
      view === "todos"
        ? b.scheduled_date.localeCompare(a.scheduled_date)
        : (a.scheduled_date + a.scheduled_time).localeCompare(b.scheduled_date + b.scheduled_time),
    );

  const groups = new Map<string, Appointment[]>();
  for (const a of list) groups.set(a.scheduled_date, [...(groups.get(a.scheduled_date) ?? []), a]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Agendamentos</h1>
        <div className="flex gap-2">
          {(
            [
              ["proximos", "Próximos"],
              ["pendentes", "Pendentes"],
              ["todos", "Todos"],
            ] as [View, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-sm border px-3 py-1.5 text-sm",
                view === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
          Nenhum agendamento por aqui.
        </div>
      )}

      {[...groups.entries()].map(([date, items]) => (
        <section key={date} className="space-y-2">
          <h2 className="text-sm text-muted-foreground">
            {date === today ? "Hoje · " : ""}
            {formatDateBR(date)}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
            {items.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AppointmentRow({ a }: { a: Appointment }) {
  const qc = useQueryClient();
  const info = appointmentStatusInfo(a.status);
  const confirmHref = waLink(a.phone, appointmentMessage(a));
  const chatHref = waLink(a.phone, `Olá, ${a.customer_name.split(" ")[0]}! Aqui é da Cleidson Diesel.`);

  async function setStatus(status: AppointmentStatus) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) { toast.error("Não foi possível atualizar."); return; }
    await qc.invalidateQueries({ queryKey: ["appointments"] });
    toast.success(status === "confirmado" ? "Agendamento confirmado." : "Agendamento atualizado.");
  }

  return (
    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="flex items-center gap-4 md:w-56">
        <span className="font-display text-2xl text-primary">{a.scheduled_time.slice(0, 5)}</span>
        <span className="plate text-base">{formatPlate(a.plate)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {a.customer_name} <span className="text-sm text-muted-foreground">· {a.phone}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {a.vehicle} · {a.service_type}
        </p>
        {a.notes && <p className="mt-1 text-sm italic text-muted-foreground">“{a.notes}”</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={info.tone} label={info.label} />
        {a.status === "pendente" && (
          <Button
            size="sm"
            onClick={async () => {
              await setStatus("confirmado");
              if (confirmHref) window.open(confirmHref, "_blank", "noopener");
            }}
          >
            <Check /> Confirmar
          </Button>
        )}
        {chatHref && (
          <Button asChild size="sm" variant="outline" aria-label="Conversar no WhatsApp">
            <a href={chatHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
            </a>
          </Button>
        )}
        {(a.status === "pendente" || a.status === "confirmado") && (
          <>
            <Button asChild size="sm" variant="secondary">
              <Link to="/painel/ordens/nova" search={{ agendamento: a.id }}>
                <ClipboardPlus /> Abrir OS
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus("cancelado")} aria-label="Cancelar agendamento">
              <X />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
