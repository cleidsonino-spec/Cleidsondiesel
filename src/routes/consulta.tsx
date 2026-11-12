import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Clock3, FileText, ShieldCheck } from "lucide-react";
import { PageHeading, PublicLayout } from "@/components/site/public-layout";
import { StatusBadge } from "@/components/site/status-badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, ORDER_PROGRESS, orderStatusInfo } from "@/lib/status";
import { formatPlate } from "@/lib/plate";
import { formatDateBR } from "@/lib/schedule";
import { readPartItems } from "@/lib/parts";
import { cn } from "@/lib/utils";

type PortalResult = {
  order: { number: number; status: string; vehicle: string; plate: string; complaint: string; entry_date: string; due_date: string | null; updated_at: string };
  quote: { state: string; token: string; expires_at: string; approved_at: string | null; snapshot: { parts_value: number; labor_value: number; part_items: unknown; parts: string | null } } | null;
  warranty: { coverage: string; start_date: string; end_date: string; terms: string } | null;
  expires_at: string;
};

export const Route = createFileRoute("/consulta")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({ meta: [
    { title: "Acompanhamento do serviço — Cleidson Diesel" },
    { name: "description", content: "Acompanhe seu serviço por um link individual e seguro." },
    { name: "robots", content: "noindex, nofollow, noarchive" },
    { name: "referrer", content: "no-referrer" },
  ] }),
  component: ConsultaPage,
});

function ConsultaPage() {
  const { token } = Route.useSearch();
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer-portal", token],
    enabled: validToken,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_customer_portal", { _token: token });
      if (error) throw error;
      return data as unknown as PortalResult | null;
    },
  });
  const order = data?.order;
  const info = order ? orderStatusInfo(order.status as Parameters<typeof orderStatusInfo>[0]) : null;
  const currentIdx = order ? ORDER_PROGRESS.indexOf(order.status as (typeof ORDER_PROGRESS)[number]) : -1;

  return <PublicLayout>
    <PageHeading eyebrow="Acompanhamento individual" title="Acompanhe seu serviço">
      Consulte as etapas do serviço, diagnóstico, orçamento e garantia pelo link seguro enviado pela oficina.
    </PageHeading>
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      {!token && <div className="rounded-md border border-border bg-card p-6 text-center">
        <ShieldCheck className="mx-auto size-9 text-primary" />
        <h2 className="mt-3 text-xl font-semibold">Seu acesso é individual</h2>
        <p className="mt-2 text-sm text-muted-foreground">Para proteger seus dados, a consulta não é feita pela placa. Solicite à Cleidson Diesel o link exclusivo de acompanhamento da sua ordem de serviço.</p>
      </div>}
      {token && !validToken && <p role="alert" className="rounded-md border border-border p-5 text-center">Link inválido. Solicite um novo acesso à oficina.</p>}
      {validToken && isLoading && <p className="py-10 text-center text-muted-foreground">Carregando acompanhamento…</p>}
      {validToken && isError && <p role="alert" className="rounded-md border border-border p-5 text-center">Não foi possível consultar agora. Tente novamente mais tarde.</p>}
      {validToken && !isLoading && !isError && !data && <p className="rounded-md border border-border p-5 text-center">Este link expirou ou foi revogado. Solicite um novo acesso à oficina.</p>}
      {order && info && <article className="overflow-hidden rounded-md border border-border bg-card shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/60 px-5 py-4">
          <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Ordem de serviço nº {order.number}</p><p className="plate text-xl">{formatPlate(order.plate)}</p><p className="text-sm text-muted-foreground">{order.vehicle}</p></div>
          <StatusBadge tone={info.tone} label={info.label} />
        </header>
        <div className="space-y-6 p-5">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Entrada" value={formatDateBR(order.entry_date)} />
            <Info label="Previsão" value={formatDateBR(order.due_date)} />
            <Info label="Última atualização" value={new Date(order.updated_at).toLocaleString("pt-BR")} />
          </div>
          <div><h2 className="font-semibold">Serviço solicitado</h2><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{order.complaint}</p></div>
          {order.status === "cancelado" ? <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">Esta ordem de serviço foi cancelada. Entre em contato com a oficina para mais informações.</p> : <ol className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {ORDER_PROGRESS.map((status, index) => {
              const reached = currentIdx >= index;
              return <li key={status} className="flex flex-col items-center gap-2 text-center">
                <span className={cn("grid size-8 place-items-center rounded-full border text-xs", reached ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground")}>{reached ? <Check className="size-4" /> : index + 1}</span>
                <span className={cn("text-[10px] leading-tight sm:text-xs", reached ? "text-foreground" : "text-muted-foreground")}>{orderStatusInfo(status).label}</span>
              </li>;
            })}
          </ol>}
          {data.quote && <section className="space-y-3 border-t border-border pt-5">
            <h2 className="flex items-center gap-2 font-semibold"><FileText className="size-4" /> Orçamento</h2>
            <p className="text-sm">{data.quote.state === "approved" ? "Orçamento aprovado" : "Orçamento aguardando sua decisão"} · válido até {new Date(data.quote.expires_at).toLocaleDateString("pt-BR")}</p>
            <div className="space-y-2 text-sm">
              {readPartItems(data.quote.snapshot.part_items).map((part, index) => <p key={index} className="flex justify-between gap-3"><span>{part.description} × {part.quantity}</span><strong>{formatBRL(part.value)}</strong></p>)}
              <p className="flex justify-between border-t border-border pt-2">Peças <strong>{formatBRL(data.quote.snapshot.parts_value)}</strong></p>
              <p className="flex justify-between">Mão de obra <strong>{formatBRL(data.quote.snapshot.labor_value)}</strong></p>
              <p className="flex justify-between text-base font-bold">Total <strong>{formatBRL(data.quote.snapshot.parts_value + data.quote.snapshot.labor_value)}</strong></p>
            </div>
            {data.quote.state === "pending" && <Button asChild><Link to="/orcamento/$token" params={{ token: data.quote.token }}>Analisar e responder orçamento</Link></Button>}
            {data.quote.state === "approved" && data.quote.approved_at && <p className="text-sm text-success">Aprovação registrada em {new Date(data.quote.approved_at).toLocaleString("pt-BR")}.</p>}
          </section>}
          {data.warranty && <section className="space-y-2 border-t border-border pt-5">
            <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> Garantia</h2>
            <p className="text-sm">{data.warranty.coverage || "Cobertura registrada"} · {formatDateBR(data.warranty.start_date)} até {formatDateBR(data.warranty.end_date)}</p>
            {data.warranty.terms && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.warranty.terms}</p>}
            {data.warranty_returns?.length > 0 && <div className="space-y-3 border-t border-border pt-3">
              <h3 className="font-semibold">Acompanhamento de retorno em garantia</h3>
              {data.warranty_returns.map((item, index) => {
                const labels: Record<string, string> = { received: "Retorno recebido", in_review: "Em análise pela oficina", resolved: "Retorno concluído", not_covered: "Análise concluída — fora da cobertura" };
                return <div key={index} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{labels[item.status] ?? "Retorno registrado"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Recebido em {formatDateBR(item.received_at)}{item.closed_at ? ` · Encerrado em ${formatDateBR(item.closed_at)}` : ""}</p>
                  {item.customer_update && <p className="mt-2 whitespace-pre-wrap">{item.customer_update}</p>}
                </div>;
              })}
            </div>}
          </section>}
          <p className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Clock3 className="size-4 shrink-0" /> Link individual válido até {new Date(data.expires_at).toLocaleDateString("pt-BR")}. Se precisar, solicite renovação à oficina.</p>
        </div>
      </article>}
    </section>
  </PublicLayout>;
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value || "—"}</p></div>;
}
