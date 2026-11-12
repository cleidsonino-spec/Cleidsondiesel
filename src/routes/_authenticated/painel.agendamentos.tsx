import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Check, ClipboardPlus, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/site/status-badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatPlate } from "@/lib/plate";
import { appointmentsQuery } from "@/lib/queries";
import { formatDateBR, getSlotsForDate, todayISO } from "@/lib/schedule";
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
  const [selectedDate, setSelectedDate] = useState(today);
  const dayAppointments = data.filter((a) => a.scheduled_date === selectedDate && a.status !== "cancelado");
  const slots = getSlotsForDate(selectedDate);

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

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Horários da oficina</h2>
              <p className="text-sm text-muted-foreground">Segunda a sexta · 08h às 17h · intervalo das 12h às 13h</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Escolher dia</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-sm border border-input bg-background px-3 py-2"
            />
          </label>
        </div>
        {slots.length === 0 ? (
          <p className="rounded-sm bg-muted p-4 text-sm text-muted-foreground">A oficina não atende nesta data. Selecione um dia de segunda a sexta.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {slots.map((time) => {
              const booked = dayAppointments.find((a) => a.scheduled_time.slice(0, 5) === time);
              return (
                <div
                  key={time}
                  className={cn(
                    "rounded-sm border p-3",
                    booked ? "border-warning/40 bg-warning/5" : "border-emerald-500/30 bg-emerald-500/5",
                  )}
                >
                  <p className="font-display text-xl">{time}</p>
                  <p className={cn("text-xs font-medium", booked ? "text-warning" : "text-emerald-600")}>
                    {booked ? "Ocupado" : "Disponível"}
                  </p>
                  {booked && <p className="mt-1 truncate text-xs text-muted-foreground">{booked.customer_name}</p>}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>🟢 Disponível</span>
          <span>🟠 Ocupado</span>
        </div>
      </section>

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
    const messages: Partial<Record<AppointmentStatus, string>> = {
      confirmado: "Agendamento confirmado.",
      compareceu: "Presença registrada.",
      nao_compareceu: "Falta registrada.",
      cancelado: "Agendamento cancelado.",
    };
    toast.success(messages[status] ?? "Agendamento atualizado.");
  }

  const reminderTomorrow = waLink(a.phone, [
    `Olá, ${a.customer_name.split(" ")[0]}! Aqui é da Cleidson Diesel.`,
    `Passando para lembrar do seu agendamento amanhã, ${formatDateBR(a.scheduled_date)}, às ${a.scheduled_time.slice(0, 5)}.`,
    `Veículo: ${a.vehicle} (${formatPlate(a.plate)}). Serviço: ${a.service_type}.`,
    "Se precisar alterar o horário, fale conosco por aqui.",
  ].join("\n"));
  const reminderToday = waLink(a.phone, [
    `Olá, ${a.customer_name.split(" ")[0]}! Aqui é da Cleidson Diesel.`,
    `Lembramos que seu atendimento está marcado para hoje, ${formatDateBR(a.scheduled_date)}, às ${a.scheduled_time.slice(0, 5)}.`,
    `Veículo: ${a.vehicle} (${formatPlate(a.plate)}). Estamos aguardando você.`,
  ].join("\n"));

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
          <>
            <Button size="sm" onClick={() => setStatus("confirmado")}><Check /> Confirmar
            </Button>
            {confirmHref && <Button asChild size="sm" variant="outline"><a href={confirmHref} target="_blank" rel="noopener noreferrer"><MessageCircle /> Avisar cliente</a></Button>}
          </>
        )}
        {a.status === "confirmado" && (
          <>
            {reminderTomorrow && <Button asChild size="sm" variant="outline"><a href={reminderTomorrow} target="_blank" rel="noopener noreferrer"><MessageCircle /> Lembrete amanhã</a></Button>}
            {reminderToday && <Button asChild size="sm" variant="outline"><a href={reminderToday} target="_blank" rel="noopener noreferrer"><MessageCircle /> Lembrete hoje</a></Button>}
            <Button size="sm" variant="secondary" onClick={() => setStatus("compareceu")}>Registrar chegada</Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus("nao_compareceu")}>Não compareceu</Button>
          </>
        )}
        {chatHref && (
          <Button asChild size="sm" variant="outline" aria-label="Conversar no WhatsApp">
            <a href={chatHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
            </a>
          </Button>
        )}
        {(a.status === "pendente" || a.status === "confirmado" || a.status === "compareceu") && (
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
