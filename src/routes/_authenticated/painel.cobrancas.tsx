import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AlertCircle, ClipboardList, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/status";
import { formatPlate } from "@/lib/plate";

type CollectionOrder = {
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

export const Route = createFileRoute("/_authenticated/painel/cobrancas")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin && !context.isSecretary) throw redirect({ to: "/painel" });
  },
  head: () => ({ meta: [
    { title: "Cobranças — Cleidson Diesel" },
    { name: "description", content: "Orçamentos com saldo pendente para cobrança." },
    { name: "robots", content: "noindex" },
  ] }),
  component: CobrancasPage,
});

function CobrancasPage() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isError, refetch } = useQuery<CollectionOrder[]>({
    queryKey: ["collection-queue"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_collection_queue");
      if (error) throw error;
      return (data ?? []) as CollectionOrder[];
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

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardList className="size-4" /> Acompanhamento de recebimentos</p>
        <h1 className="mt-1 text-3xl">Cobranças</h1>
        <p className="mt-1 text-sm text-muted-foreground">Orçamentos com saldo pendente. Abra a OS para consultar os dados do cliente e registrar a confirmação do pagamento.</p>
      </div>
      <Button variant="outline" onClick={() => void refetch()}><RefreshCw className="mr-2 size-4" /> Atualizar</Button>
    </div>

    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, placa ou número da OS" className="h-11 pl-10" aria-label="Buscar cobranças" />
    </div>

    {isLoading ? <div className="py-12 text-center text-muted-foreground">Carregando cobranças…</div>
      : isError ? <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /> Não foi possível carregar a lista de cobranças. A função de consulta precisa estar instalada no Supabase.</div>
      : filtered.length === 0 ? <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">{data.length === 0 ? "Não há orçamentos com saldo pendente." : "Nenhuma cobrança corresponde à busca."}</div>
      : <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{filtered.length} orçamento(s) pendente(s)</p>
        {filtered.map((item) => <article key={item.service_order_id} className="space-y-3 rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">OS nº {item.order_number} · {item.customer_name}</p>
              <p className="text-sm text-muted-foreground">{formatPlate(item.plate)} · {item.order_status.replaceAll("_", " ")}</p>
            </div>
            <Link to="/painel/ordens/$id" params={{ id: item.service_order_id }} className="text-sm font-medium text-primary hover:underline">Abrir OS e cobrança</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Value label="Orçamento" value={formatBRL(Number(item.total))} />
            <Value label="Recebido" value={formatBRL(Number(item.received))} />
            <Value label="Falta receber" value={formatBRL(Number(item.balance))} />
            <Value label="Pago" value={`${Number(item.paid_percent).toFixed(1).replace(".", ",")}%`} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Number(item.paid_percent))}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Último pagamento confirmado: {item.last_payment_at ? new Date(item.last_payment_at).toLocaleString("pt-BR") : "Nenhum"}</p>
        </article>)}
      </div>}
  </div>;
}

function Value({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/50 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 font-semibold tabular-nums">{value}</p>
  </div>;
}
