import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, ClipboardList, Search, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/site/status-badge";
import { Input } from "@/components/ui/input";
import { formatPlate, normalizePlate } from "@/lib/plate";
import { appointmentsQuery, ordersQuery } from "@/lib/queries";
import { formatDateBR, todayISO } from "@/lib/schedule";
import {
  appointmentStatusInfo,
  formatBRL,
  OPEN_ORDER_STATUSES,
  ORDER_STATUSES,
  orderStatusInfo,
  orderTotal,
  type OrderStatus,
} from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(ordersQuery()),
      context.queryClient.ensureQueryData(appointmentsQuery()),
    ]),
  component: PainelIndex,
});

type Filter = "abertas" | "todas" | OrderStatus;

function PainelIndex() {
  const { data: orders } = useSuspenseQuery(ordersQuery());
  const { data: appointments } = useSuspenseQuery(appointmentsQuery());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("abertas");

  const q = normalizePlate(search);
  const today = todayISO();

  const stats = useMemo(
    () => ({
      open: orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status) && o.status !== "pronto").length,
      ready: orders.filter((o) => o.status === "pronto").length,
      waiting: orders.filter((o) => o.status === "aguardando_aprovacao").length,
      today: appointments.filter((a) => a.scheduled_date === today && a.status !== "cancelado").length,
    }),
    [orders, appointments, today],
  );

  const filtered = orders.filter((o) => {
    if (q) return o.plate.includes(q) || o.customer_name.toUpperCase().includes(search.trim().toUpperCase());
    if (filter === "todas") return true;
    if (filter === "abertas") return OPEN_ORDER_STATUSES.includes(o.status);
    return o.status === filter;
  });

  const plateAppointments = q.length >= 3 ? appointments.filter((a) => a.plate.includes(q)) : [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Wrench />} label="Em andamento" value={stats.open} />
        <Stat icon={<ClipboardList />} label="Aguardando aprovação" value={stats.waiting} />
        <Stat icon={<CheckCircle2 />} label="Prontos p/ retirada" value={stats.ready} accent />
        <Stat icon={<CalendarClock />} label="Agendados hoje" value={stats.today} />
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por placa ou nome do cliente"
            className="h-14 pl-12 text-lg"
            aria-label="Buscar por placa"
          />
        </div>
        {!q && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                { v: "abertas", l: "Abertas" },
                { v: "todas", l: "Todas" },
                ...ORDER_STATUSES.map((s) => ({ v: s.value, l: s.label })),
              ] as { v: Filter; l: string }[]
            ).map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                className={cn(
                  "shrink-0 rounded-sm border px-3 py-1.5 text-sm transition-colors",
                  filter === f.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {f.l}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg">
          {q ? `Histórico — ${formatPlate(q)}` : "Ordens de serviço"}{" "}
          <span className="font-sans text-sm normal-case text-muted-foreground">({filtered.length})</span>
        </h2>
        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
            {q ? "Nenhuma ordem de serviço para essa busca." : "Nenhuma ordem de serviço aqui ainda."}{" "}
            <Link to="/painel/ordens/nova" search={{}} className="text-primary hover:underline">
              Abrir nova OS
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
            {filtered.map((o) => {
              const info = orderStatusInfo(o.status);
              return (
                <Link
                  key={o.id}
                  to="/painel/ordens/$id"
                  params={{ id: o.id }}
                  className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-secondary md:grid-cols-[90px_140px_1fr_auto_auto]"
                >
                  <span className="font-display text-sm text-muted-foreground">#{o.number}</span>
                  <span className="plate text-lg md:order-none">{formatPlate(o.plate)}</span>
                  <span className="col-span-2 min-w-0 md:col-span-1">
                    <span className="block truncate font-medium">{o.customer_name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {o.vehicle} · {o.complaint}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDateBR(o.entry_date)} · {formatBRL(orderTotal(o.parts_value, o.labor_value))}
                  </span>
                  <span className="justify-self-end">
                    <StatusBadge tone={info.tone} label={info.label} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {plateAppointments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg">Agendamentos dessa placa</h2>
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
            {plateAppointments.map((a) => {
              const info = appointmentStatusInfo(a.status);
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {formatDateBR(a.scheduled_date)} às {a.scheduled_time.slice(0, 5)} — {a.customer_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPlate(a.plate)} · {a.vehicle} · {a.service_type}
                    </p>
                  </div>
                  <StatusBadge tone={info.tone} label={info.label} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border p-4 [&_svg]:size-5",
        accent ? "border-primary/50 bg-primary/10 [&_svg]:text-primary" : "border-border bg-card [&_svg]:text-muted-foreground",
      )}
    >
      {icon}
      <p className="mt-3 font-display text-3xl">{value}</p>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
