import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight, CalendarClock, CheckCircle2, ClipboardList, Clock3,
  Plus, Search, ShieldAlert, ShieldCheck, Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/site/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appointmentsQuery, ordersQuery } from "@/lib/queries";
import { warrantiesQuery, warrantyState } from "@/lib/warranty";
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
import { formatPlate, normalizePlate } from "@/lib/plate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel/")({
  head: () => ({ meta: [
    { title: "Painel geral — Cleidson Diesel" },
    { name: "description", content: "Visão geral da operação da oficina Cleidson Diesel." },
    { property: "og:title", content: "Painel geral — Cleidson Diesel" },
    { property: "og:description", content: "Acompanhamento diário da oficina." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(ordersQuery()),
      context.queryClient.ensureQueryData(appointmentsQuery()),
      context.queryClient.ensureQueryData(warrantiesQuery()),
    ]),
  component: PainelIndex,
});

type Filter = "abertas" | "todas" | OrderStatus;

function daysUntil(date: string, today: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

function PainelIndex() {
  const { data: orders } = useSuspenseQuery(ordersQuery());
  const { data: appointments } = useSuspenseQuery(appointmentsQuery());
  const { data: warranties } = useSuspenseQuery(warrantiesQuery());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("abertas");

  const today = todayISO();
  const q = normalizePlate(search);
  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status) && o.status !== "pronto");
    const ready = orders.filter((o) => o.status === "pronto");
    const waiting = orders.filter((o) => o.status === "aguardando_aprovacao");
    const todayAppointments = appointments.filter((a) => a.scheduled_date === today && a.status !== "cancelado" && a.status !== "concluido");
    const expiringWarranties = warranties.filter((w) => {
      const state = warrantyState(w.start_date, w.end_date, today);
      const days = daysUntil(w.end_date, today);
      return state === "Vigente" && days >= 0 && days <= 30;
    });
    return {
      open: activeOrders.length,
      ready: ready.length,
      waiting: waiting.length,
      today: todayAppointments.length,
      expiring: expiringWarranties.length,
      todayAppointments,
      expiringWarranties,
    };
  }, [orders, appointments, warranties, today]);

  const filtered = orders.filter((o) => {
    if (q) return normalizePlate(o.plate).includes(q) || o.customer_name.toUpperCase().includes(search.trim().toUpperCase());
    if (filter === "todas") return true;
    if (filter === "abertas") return OPEN_ORDER_STATUSES.includes(o.status);
    return o.status === filter;
  });
  const plateAppointments = q.length >= 3 ? appointments.filter((a) => normalizePlate(a.plate).includes(q)) : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Acompanhamento da operação</p>
          <h1 className="text-3xl">Painel geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">Resumo de hoje · {formatDateBR(today)}</p>
        </div>
        <Button asChild>
          <Link to="/painel/ordens/nova" search={{}}><Plus /> Nova ordem de serviço</Link>
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores da oficina">
        <Stat icon={<Wrench />} label="Em andamento" value={stats.open} href="/painel/" />
        <Stat icon={<ClipboardList />} label="Aguardando aprovação" value={stats.waiting} href="/painel/" />
        <Stat icon={<CheckCircle2 />} label="Prontos para retirada" value={stats.ready} href="/painel/" accent />
        <Stat icon={<CalendarClock />} label="Agendamentos de hoje" value={stats.today} href="/painel/agendamentos" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><CalendarClock className="size-5 text-muted-foreground" /><h2 className="font-semibold">Agenda de hoje</h2></div>
            <Link to="/painel/agendamentos" className="text-sm text-primary hover:underline">Ver agenda</Link>
          </div>
          {stats.todayAppointments.length === 0 ? (
            <p className="py-5 text-sm text-muted-foreground">Não há agendamentos pendentes ou confirmados para hoje.</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.todayAppointments.slice().sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)).slice(0, 5).map((a) => {
                const info = appointmentStatusInfo(a.status);
                return <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0"><p className="font-medium">{a.scheduled_time.slice(0, 5)} · {a.customer_name}</p><p className="truncate text-sm text-muted-foreground">{formatPlate(a.plate)} · {a.vehicle} · {a.service_type}</p></div>
                  <StatusBadge tone={info.tone} label={info.label} />
                </div>;
              })}
            </div>
          )}
        </div>

        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-muted-foreground" /><h2 className="font-semibold">Atenção às garantias</h2></div>
            <Link to="/painel/garantias" className="text-sm text-primary hover:underline">Ver garantias</Link>
          </div>
          <div className="flex items-center gap-3 rounded-md bg-secondary/60 p-3">
            <div className="text-3xl font-semibold tabular-nums">{stats.expiring}</div>
            <p className="text-sm text-muted-foreground">garantia(s) vigente(s) vencendo nos próximos 30 dias</p>
          </div>
          {stats.expiringWarranties.length > 0 ? (
            <div className="mt-2 divide-y divide-border">
              {stats.expiringWarranties.slice(0, 4).map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{w.service_orders?.customer_name ?? "Cliente"}</p><p className="text-muted-foreground">OS nº {w.service_orders?.number} · {formatPlate(w.service_orders?.plate ?? "")}</p></div>
                  <span className="shrink-0 text-muted-foreground">{formatDateBR(w.end_date)}</span>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-muted-foreground">Nenhuma garantia próxima do vencimento.</p>}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-xl">Ordens de serviço</h2><p className="text-sm text-muted-foreground">Pesquise e acompanhe os serviços cadastrados.</p></div>
          <Link to="/painel/ordens/nova" search={{}} className="text-sm text-primary hover:underline">Cadastrar nova OS <ArrowUpRight className="inline size-4" /></Link>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por placa ou nome do cliente" className="h-12 pl-12" aria-label="Buscar por placa ou cliente" />
        </div>
        {!q && <div className="flex gap-2 overflow-x-auto pb-1">
          {([{ v: "abertas", l: "Abertas" }, { v: "todas", l: "Todas" }, ...ORDER_STATUSES.map((s) => ({ v: s.value, l: s.label }))] as { v: Filter; l: string }[]).map((f) => (
            <button key={f.v} onClick={() => setFilter(f.v)} className={cn("shrink-0 rounded-sm border px-3 py-1.5 text-sm transition-colors", filter === f.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{f.l}</button>
          ))}
        </div>}
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium text-muted-foreground">{q ? `Resultados para ${search}` : "Ordens recentes"} ({filtered.length})</h3>{search && <Button variant="ghost" size="sm" onClick={() => setSearch("")}>Limpar busca</Button>}</div>
        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
            {q ? "Nenhuma ordem de serviço para essa busca." : "Nenhuma ordem de serviço aqui ainda."}{" "}
            <Link to="/painel/ordens/nova" search={{}} className="text-primary hover:underline">Abrir nova OS</Link>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
            {filtered.slice(0, 12).map((o) => {
              const info = orderStatusInfo(o.status);
              return <Link key={o.id} to="/painel/ordens/$id" params={{ id: o.id }} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-secondary md:grid-cols-[90px_140px_1fr_auto_auto]">
                <span className="font-display text-sm text-muted-foreground">#{o.number}</span>
                <span className="plate text-lg">{formatPlate(o.plate)}</span>
                <span className="col-span-2 min-w-0 md:col-span-1"><span className="block truncate font-medium">{o.customer_name}</span><span className="block truncate text-sm text-muted-foreground">{o.vehicle} · {o.complaint}</span></span>
                <span className="text-sm text-muted-foreground">{formatDateBR(o.entry_date)} · {formatBRL(orderTotal(o.parts_value, o.labor_value))}</span>
                <span className="justify-self-end"><StatusBadge tone={info.tone} label={info.label} /></span>
              </Link>;
            })}
          </div>
        )}
        {!q && filtered.length > 12 && <p className="text-center text-sm text-muted-foreground">Exibindo as 12 ordens mais recentes. Use os filtros para localizar outras.</p>}
      </section>

      {plateAppointments.length > 0 && <section className="space-y-3">
        <h2 className="text-lg">Agendamentos dessa placa</h2>
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
          {plateAppointments.map((a) => { const info = appointmentStatusInfo(a.status); return <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="font-medium">{formatDateBR(a.scheduled_date)} às {a.scheduled_time.slice(0, 5)} — {a.customer_name}</p><p className="text-sm text-muted-foreground">{formatPlate(a.plate)} · {a.vehicle} · {a.service_type}</p></div><StatusBadge tone={info.tone} label={info.label} /></div>; })}
        </div>
      </section>}
    </div>
  );
}

function Stat({ icon, label, value, href, accent }: { icon: React.ReactNode; label: string; value: number; href: "/painel/" | "/painel/agendamentos"; accent?: boolean }) {
  return <Link to={href} className={cn("rounded-md border p-4 transition-colors hover:bg-secondary/70 [&_svg]:size-5", accent ? "border-primary/50 bg-primary/10 [&_svg]:text-primary" : "border-border bg-card [&_svg]:text-muted-foreground")}>
    {icon}<p className="mt-3 font-display text-3xl tabular-nums">{value}</p><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
  </Link>;
}
