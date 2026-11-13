import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, FileText, Loader2, Search } from "lucide-react";
import { StatusBadge } from "@/components/site/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatPlate, normalizePlate } from "@/lib/plate";

export const Route = createFileRoute("/_authenticated/painel/relatorios")({
  head: () => ({ meta: [
    { title: "Relatórios técnicos — Cleidson Diesel" },
    { name: "description", content: "Central de relatórios técnicos de inspeção da oficina." },
    { name: "robots", content: "noindex" },
  ] }),
  component: InspectionReportsPage,
});

type Status = "draft" | "pending_review" | "approved" | "returned";
type Filter = "all" | Status;
type ReportRow = {
  id: string;
  service_order_id: string;
  diagnosis: string | null;
  executed_parts: string | null;
  rejected_items: string | null;
  inspection_observations: string | null;
  status: Status;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  service_orders: {
    id: string;
    number: number;
    customer_name: string;
    vehicle: string;
    plate: string;
    status: string;
  } | null;
};

const labels: Record<Status, string> = {
  draft: "Em preenchimento",
  pending_review: "Aguardando revisão",
  approved: "Aprovado",
  returned: "Devolvido",
};

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function InspectionReportsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["inspection-reports", "management"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_order_inspection_reports")
        .select("id,service_order_id,diagnosis,executed_parts,rejected_items,inspection_observations,status,submitted_at,reviewed_at,created_at,updated_at,service_orders(id,number,customer_name,vehicle,plate,status)")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const term = search.trim().toLocaleLowerCase("pt-BR");
  const normalized = normalizePlate(search);
  const filtered = useMemo(() => data.filter((row) => {
    if (filter !== "all" && row.status !== filter) return false;
    if (!term) return true;
    const order = row.service_orders;
    return String(order?.number ?? "").includes(term)
      || (order?.customer_name ?? "").toLocaleLowerCase("pt-BR").includes(term)
      || (order?.vehicle ?? "").toLocaleLowerCase("pt-BR").includes(term)
      || normalizePlate(order?.plate ?? "").includes(normalized);
  }), [data, filter, term, normalized]);

  const counts = useMemo(() => data.reduce((acc, row) => {
    acc.total += 1;
    acc[row.status] += 1;
    return acc;
  }, { total: 0, draft: 0, pending_review: 0, approved: 0, returned: 0 }), [data]);

  const filters: [Filter, string][] = [
    ["all", "Todos"], ["pending_review", "Aguardando revisão"],
    ["approved", "Aprovados"], ["returned", "Devolvidos"], ["draft", "Em preenchimento"],
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">Central de documentos da oficina</p>
        <h1 className="text-3xl">Relatórios técnicos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Consulte, revise e acompanhe os relatórios de inspeção vinculados às ordens de serviço.</p>
      </div>
      <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
        <ClipboardList className={isFetching ? "animate-pulse" : ""} /> Atualizar
      </Button>
    </div>

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Resumo dos relatórios">
      <Summary label="Total" value={counts.total} />
      <Summary label="Aguardando revisão" value={counts.pending_review} />
      <Summary label="Aprovados" value={counts.approved} />
      <Summary label="Devolvidos" value={counts.returned} />
      <Summary label="Em preenchimento" value={counts.draft} />
    </section>

    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por OS, cliente, veículo ou placa" className="h-11 pl-10" aria-label="Buscar relatório técnico" />
    </div>

    <div className="flex flex-wrap gap-2">
      {filters.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)}
        className={`rounded-sm border px-3 py-2 text-sm ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
        {label}{value === "all" ? ` (${counts.total})` : ` (${counts[value]})`}
      </button>)}
    </div>

    {isLoading ? <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="animate-spin" /> Carregando relatórios...</div>
      : isError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">Não foi possível carregar os relatórios. Verifique se as migrations da funcionalidade foram aplicadas no ambiente de teste.</div>
      : filtered.length === 0 ? <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">Nenhum relatório encontrado para esse filtro.</div>
      : <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{filtered.length} relatório(s) encontrado(s)</p>
        {filtered.map((row) => {
          const order = row.service_orders;
          const hasContent = Boolean(row.diagnosis || row.executed_parts || row.rejected_items || row.inspection_observations);
          return <article key={row.id} className="space-y-3 rounded-md border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{order ? `OS nº ${order.number} · ${order.customer_name}` : "Ordem de serviço indisponível"}</p>
                {order && <p className="mt-1 text-sm text-muted-foreground">{order.vehicle} · {formatPlate(order.plate)}</p>}
              </div>
              <StatusBadge tone={row.status === "approved" ? "success" : row.status === "pending_review" ? "warning" : row.status === "returned" ? "destructive" : "info"} label={labels[row.status]} />
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Atualizado:</span> {dateLabel(row.updated_at)}</p>
              <p><span className="text-muted-foreground">Enviado para revisão:</span> {dateLabel(row.submitted_at)}</p>
              <p><span className="text-muted-foreground">Conteúdo:</span> {hasContent ? "Preenchido" : "Ainda sem informações"}</p>
              <p><span className="text-muted-foreground">Situação da OS:</span> {order?.status ?? "—"}</p>
            </div>
            {order && <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button asChild size="sm" variant="outline"><Link to="/painel/ordens/$id" params={{ id: order.id }}><FileText /> Abrir relatório na OS</Link></Button>
            </div>}
          </article>;
        })}
      </div>}
    <p className="text-xs text-muted-foreground">O relatório é um documento separado do orçamento. A emissão do PDF e o compartilhamento continuam disponíveis somente após aprovação, na ordem de serviço.</p>
  </div>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-border bg-card p-3"><p className="font-display text-2xl tabular-nums">{value}</p><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p></div>;
}
