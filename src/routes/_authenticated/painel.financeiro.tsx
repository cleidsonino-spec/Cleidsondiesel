import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Loader2, Search, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/status";
import { formatPlate } from "@/lib/plate";

type FinancialOrder = {
  service_order_id: string;
  order_number: number;
  customer_name: string;
  plate: string;
  order_status: string;
  total: number;
  received: number;
  balance: number;
  paid_percent: number;
  last_payment_at: string | null;
};

export const Route = createFileRoute("/_authenticated/painel/financeiro")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/painel" });
  },
  head: () => ({ meta: [
    { title: "Financeiro — Cleidson Diesel" },
    { name: "description", content: "Recebimentos confirmados por ordem de serviço." },
    { name: "robots", content: "noindex" },
  ] }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isError, refetch } = useQuery<FinancialOrder[]>({
    queryKey: ["financial-overview"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_get_financial_overview");
      if (error) throw error;
      return (data ?? []) as FinancialOrder[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data;
    return data.filter((item) =>
      item.customer_name.toLocaleLowerCase("pt-BR").includes(term)
      || formatPlate(item.plate).toLocaleLowerCase("pt-BR").includes(term)
      || String(item.order_number).includes(term)
    );
  }, [data, search]);

  const totals = useMemo(() => data.reduce((acc, item) => ({
    budget: acc.budget + Number(item.total),
    received: acc.received + Number(item.received),
    balance: acc.balance + Number(item.balance),
  }), { budget: 0, received: 0, balance: 0 }), [data]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet className="size-4" /> Controle de recebimentos</p>
        <h1 className="mt-1 text-3xl">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">Somente pagamentos confirmados nas ordens de serviço.</p>
      </div>
      <Button variant="outline" onClick={() => void refetch()}>Atualizar</Button>
    </div>

    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumo financeiro">
      <Summary label="Orçamentos" value={formatBRL(totals.budget)} />
      <Summary label="Total recebido" value={formatBRL(totals.received)} />
      <Summary label="Saldo pendente" value={formatBRL(totals.balance)} />
    </section>

    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, placa ou número da OS" className="h-11 pl-10" aria-label="Buscar no financeiro" />
    </div>

    {isLoading ? <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando financeiro…</div>
      : isError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">Não foi possível carregar os recebimentos. Verifique a migration e atualize a página.</div>
      : filtered.length === 0 ? <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">Nenhuma OS encontrada.</div>
      : <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{filtered.length} ordem(ns) encontrada(s)</p>
        {filtered.map((item) => <article key={item.service_order_id} className="space-y-3 rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">OS nº {item.order_number} · {item.customer_name}</p>
              <p className="text-sm text-muted-foreground">{formatPlate(item.plate)} · {item.order_status.replaceAll("_", " ")}</p>
            </div>
            <Link to="/painel/ordens/$id" params={{ id: item.service_order_id }} className="text-sm font-medium text-primary hover:underline">Abrir OS</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Value label="Orçamento" value={formatBRL(Number(item.total))} />
            <Value label="Recebido" value={formatBRL(Number(item.received))} />
            <Value label="Pendente" value={formatBRL(Number(item.balance))} />
            <Value label="Pago" value={`${Number(item.paid_percent).toFixed(1).replace(".", ",")}%`} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Number(item.paid_percent))}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Último recebimento: {item.last_payment_at ? new Date(item.last_payment_at).toLocaleString("pt-BR") : "Nenhum"}</p>
        </article>)}
      </div>}
  </div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-card p-4">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
  </div>;
}

function Value({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/50 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 font-semibold tabular-nums">{value}</p>
  </div>;
}
