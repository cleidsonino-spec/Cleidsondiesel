import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, FileText, Link2, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/site/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { approvalUrl } from "@/lib/approval";
import { formatBRL, orderTotal } from "@/lib/status";
import { formatPlate, normalizePlate } from "@/lib/plate";

export const Route = createFileRoute("/_authenticated/painel/orcamentos")({
  head: () => ({ meta: [
    { title: "Orçamentos enviados — Cleidson Diesel" },
    { name: "description", content: "Consulte os orçamentos e autorizações da oficina." },
    { name: "robots", content: "noindex" },
  ] }),
  component: OrcamentosPage,
});

type Filter = "todos" | "pending" | "approved" | "rejected" | "expired";

function approvalStatus(item: { state: string; expires_at: string }) {
  if (item.state === "approved") return { key: "approved" as const, label: "Aprovado", tone: "success" as const };
  if (item.state === "rejected" || item.state === "refused") return { key: "rejected" as const, label: "Recusado", tone: "destructive" as const };
  if (item.state === "revoked" || Date.parse(item.expires_at) <= Date.now()) return { key: "expired" as const, label: "Expirado", tone: "warning" as const };
  return { key: "pending" as const, label: "Pendente", tone: "info" as const };
}

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function OrcamentosPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["quote-approvals", "all"],
    refetchInterval: 15000,
    queryFn: async () => {
      const fetchPage = (from: number) => supabase
        .from("quote_approvals")
        .select("id,token,state,expires_at,approved_at,approved_by,rejected_at,rejected_by,created_at,order_id,service_orders(id,number,customer_name,phone,vehicle,plate,status,parts_value,labor_value)")
        .order("created_at", { ascending: false })
        .range(from, from + 499);
      const first = await fetchPage(0);
      if (first.error) throw first.error;
      const all = [...first.data];
      let from = 500;
      while (first.data.length === 500) {
        const page = await fetchPage(from);
        if (page.error) throw page.error;
        all.push(...page.data);
        if (page.data.length < 500) break;
        from += 500;
      }
      return all;
    },
  });

  const q = normalizePlate(search);
  const filtered = useMemo(() => data.filter((item) => {
    const status = approvalStatus(item);
    const order = item.service_orders;
    if (filter !== "todos" && status.key !== filter) return false;
    if (!q && !search.trim()) return true;
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return normalizePlate(order?.plate ?? "").includes(q)
      || String(order?.number ?? "").includes(term)
      || (order?.customer_name ?? "").toLocaleLowerCase("pt-BR").includes(term);
  }), [data, filter, q, search]);

  async function renew(orderId: string) {
    setBusyId(orderId);
    try {
      const { error } = await supabase.rpc("issue_quote_approval", { _order_id: orderId });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["quote-approvals"] });
      toast.success("Novo link de aprovação gerado.");
    } catch {
      toast.error("Não foi possível gerar um novo link. Confira se a OS ainda permite autorização.");
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => data.reduce((acc, item) => {
    acc[approvalStatus(item).key] += 1;
    return acc;
  }, { pending: 0, approved: 0, rejected: 0, expired: 0 }), [data]);

  return <div className="space-y-6">
    <div>
      <p className="text-sm text-muted-foreground">Controle de autorização</p>
      <h1 className="text-3xl">Orçamentos enviados</h1>
      <p className="mt-1 text-sm text-muted-foreground">Consulte links emitidos, aprovações e prazos de validade.</p>
    </div>

    <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Resumo dos orçamentos">
      <Summary label="Pendentes" value={counts.pending} />
      <Summary label="Aprovados" value={counts.approved} />
      <Summary label="Recusados" value={counts.rejected} />
      <Summary label="Expirados" value={counts.expired} />
      <Summary label="Valor aprovado" value={formatBRL(counts.approvedValue)} />
      <Summary label="Valor recusado" value={formatBRL(counts.rejectedValue)} />
    </section>

    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, placa ou número da OS" className="h-11 pl-10" aria-label="Buscar orçamento" />
    </div>
    <div className="flex flex-wrap gap-2">
      {([
        ["todos", "Todos"], ["pending", "Pendentes"], ["approved", "Aprovados"],
        ["rejected", "Recusados"], ["expired", "Expirados"],
      ] as [Filter, string][]).map(([value, label]) => (
        <button key={value} type="button" onClick={() => setFilter(value)}
          className={`rounded-sm border px-3 py-2 text-sm ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
          {label}
        </button>
      ))}
    </div>

    {isLoading ? <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="animate-spin" /> Carregando orçamentos…</div>
      : isError ? <p role="alert" className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">Não foi possível carregar os orçamentos. Atualize a página e tente novamente.</p>
      : filtered.length === 0 ? <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">Nenhum orçamento encontrado para esse filtro.</div>
      : <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{filtered.length} orçamento(s) encontrado(s)</p>
        {filtered.map((item) => {
          const order = item.service_orders;
          const status = approvalStatus(item);
          const canRenew = order && !["pronto", "entregue", "cancelado"].includes(order.status);
          let publicUrl: string | null = null;
          try { publicUrl = approvalUrl(item.token); } catch { /* token inválido: não exibir link */ }
          return <article key={item.id} className="space-y-3 rounded-md border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{order ? `OS nº ${order.number} · ${order.customer_name}` : "Ordem de serviço indisponível"}</p>
                {order && <p className="mt-1 text-sm text-muted-foreground">{order.vehicle} · {formatPlate(order.plate)}</p>}
                {order && <p className="mt-1 text-sm font-medium">{formatBRL(orderTotal(order.parts_value, order.labor_value))}</p>}
              </div>
              <StatusBadge tone={status.tone} label={status.label} />
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Link emitido:</span> {dateTime(item.created_at)}</p>
              <p><span className="text-muted-foreground">Aprovação:</span> {dateTime(item.approved_at)}</p>
              {item.approved_by && <p><span className="text-muted-foreground">Aprovado por:</span> {item.approved_by}</p>}
              <p><span className="text-muted-foreground">Validade:</span> {dateTime(item.expires_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {order && <Button asChild size="sm" variant="outline"><Link to="/painel/ordens/$id" params={{ id: order.id }}><FileText /> Abrir OS / PDF atualizado</Link></Button>}
              {publicUrl && status.key === "pending" && <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(publicUrl!); toast.success("Link copiado."); }}><Link2 /> Copiar link</Button>}
              {order && canRenew && <Button size="sm" onClick={() => void renew(order.id)} disabled={busyId === order.id}>
                {busyId === order.id ? <Loader2 className="animate-spin" /> : <RefreshCw />} Gerar novo link
              </Button>}
            </div>
          </article>;
        })}
      </div>}
  </div>;
}

function Summary({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-md border border-border bg-card p-3"><p className="font-display text-2xl tabular-nums">{value}</p><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p></div>;
}
