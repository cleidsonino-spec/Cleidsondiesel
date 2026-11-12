import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, CheckCircle2, ClipboardList, Clock3, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, orderTotal } from "@/lib/status";
import { formatDateBR, todayISO } from "@/lib/schedule";

type OrderRow = {
  id: string;
  number: number;
  status: string;
  entry_date: string;
  updated_at: string;
  parts_value: number | string;
  labor_value: number | string;
};

type Period = "30" | "90" | "365" | "all";

export const Route = createFileRoute("/_authenticated/painel/indicadores")({
  head: () => ({ meta: [
    { title: "Indicadores da oficina — Cleidson Diesel" },
    { name: "description", content: "Indicadores operacionais das ordens de serviço." },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: IndicatorsPage,
});

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function IndicatorsPage() {
  const [period, setPeriod] = useState<Period>("90");
  const ordersQuery = useQuery({
    queryKey: ["operational-indicators-orders"],
    queryFn: async () => {
      const all: OrderRow[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from("service_orders")
          .select("id,number,status,entry_date,updated_at,parts_value,labor_value")
          .order("entry_date", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        all.push(...(data ?? []) as OrderRow[]);
        if (!data || data.length < pageSize) return all;
      }
    },
  });

  const today = todayISO();
  const filtered = useMemo(() => {
    const start = period === "all" ? null : dateDaysAgo(Number(period));
    return (ordersQuery.data ?? []).filter((order) => !start || order.entry_date >= start && order.entry_date <= today);
  }, [ordersQuery.data, period, today]);

  const stats = useMemo(() => {
    const completed = filtered.filter((o) => o.status === "pronto" || o.status === "entregue");
    const open = filtered.filter((o) => !["pronto", "entregue", "cancelado"].includes(o.status));
    const waiting = filtered.filter((o) => o.status === "aguardando_aprovacao");
    const completedTotal = completed.reduce((sum, o) => sum + orderTotal(o.parts_value, o.labor_value), 0);
    const monthMap = new Map<string, { count: number; total: number }>();
    for (const order of completed) {
      const month = order.entry_date.slice(0, 7);
      const current = monthMap.get(month) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += orderTotal(order.parts_value, order.labor_value);
      monthMap.set(month, current);
    }
    const months = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    const max = Math.max(1, ...months.map(([, value]) => value.count));
    return { total: filtered.length, completed: completed.length, open: open.length, waiting: waiting.length, completedTotal, average: completed.length ? completedTotal / completed.length : 0, months: months.map(([month, value]) => ({ month, ...value, width: value.count / max * 100 })) };
  }, [filtered]);

  if (ordersQuery.isLoading) return <div className="rounded-lg border p-8 text-muted-foreground">Carregando indicadores…</div>;
  if (ordersQuery.isError) return <div className="rounded-lg border border-destructive/40 p-8 text-destructive">Não foi possível carregar os indicadores. Tente atualizar a página.</div>;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-muted-foreground">Gestão da oficina</p><h1 className="text-3xl font-semibold">Indicadores operacionais</h1><p className="mt-1 text-sm text-muted-foreground">Visão das ordens de serviço cadastradas.</p></div>
      <select aria-label="Período dos indicadores" value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 12 meses</option><option value="all">Todo o histórico</option>
      </select>
    </header>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric icon={<ClipboardList />} label="OS no período" value={String(stats.total)} />
      <Metric icon={<CheckCircle2 />} label="Serviços concluídos" value={String(stats.completed)} />
      <Metric icon={<Activity />} label="OS em aberto" value={String(stats.open)} />
      <Metric icon={<Clock3 />} label="Aguardando aprovação" value={String(stats.waiting)} />
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Total lançado nas OS concluídas</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{formatBRL(stats.completedTotal)}</p>
        <p className="mt-2 text-xs text-muted-foreground">Soma de peças e mão de obra das OS com status pronto ou entregue. Não representa necessariamente valores recebidos.</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Valor médio lançado por OS concluída</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{formatBRL(stats.average)}</p>
        <p className="mt-2 text-xs text-muted-foreground">Média calculada sobre os valores registrados nas OS concluídas do período.</p>
      </div>
    </section>

    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2"><TrendingUp className="size-5 text-primary" /><h2 className="font-semibold">Serviços concluídos por mês</h2></div>
      {stats.months.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há serviços concluídos neste período.</p> : <div className="space-y-4">
        {stats.months.map((month) => <div key={month.month} className="grid grid-cols-[90px_1fr_42px] items-center gap-3">
          <span className="text-sm capitalize text-muted-foreground">{new Date(Number(month.month.slice(0, 4)), Number(month.month.slice(5, 7)) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}</span>
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${month.width}%` }} /></div>
          <span className="text-right text-sm font-medium tabular-nums">{month.count}</span>
        </div>)}
      </div>}
    </section>

    <p className="flex items-start gap-2 rounded-md border border-border p-4 text-xs text-muted-foreground"><CalendarDays className="size-4 shrink-0" />Período filtrado até {formatDateBR(today)}. Estes indicadores são operacionais e usam os valores lançados nas ordens. Lucro, despesas e recebimentos só serão apresentados depois que o módulo financeiro e os custos estiverem integrados e validados.</p>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div><p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p></div>;
}
