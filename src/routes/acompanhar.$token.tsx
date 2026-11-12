import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/site/public-layout";
import { StatusBadge } from "@/components/site/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { formatPlate } from "@/lib/plate";
import { formatDateBR } from "@/lib/schedule";
import { orderStatusInfo } from "@/lib/status";

type PortalData = {
  number: number;
  customer_name: string;
  vehicle: string;
  vehicle_year: string | null;
  plate: string;
  complaint: string;
  diagnosis: string | null;
  status: string;
  entry_date: string;
  due_date: string | null;
  updated_at: string;
  warranty: null | { start_date: string; end_date: string; coverage: string; terms: string };
};

export const Route = createFileRoute("/acompanhar/$token")({
  head: () => ({ meta: [
    { title: "Acompanhamento do serviço — Cleidson Diesel" },
    { name: "description", content: "Acompanhe o andamento do serviço do seu veículo." },
    { name: "robots", content: "noindex, nofollow, noarchive" },
    { name: "referrer", content: "no-referrer" },
  ] }),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const { token } = Route.useParams();
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-portal", token],
    enabled: validToken,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_client_portal", { _token: token });
      if (error) throw error;
      return (data ?? null) as PortalData | null;
    },
  });

  if (isLoading) return <PublicLayout><main className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4"><Loader2 className="animate-spin" /> <span className="ml-2">Carregando acompanhamento…</span></main></PublicLayout>;

  if (!validToken || isError || !data) return <PublicLayout><main className="mx-auto max-w-2xl px-4 py-16 text-center"><ShieldCheck className="mx-auto size-10 text-muted-foreground" /><h1 className="mt-4 text-2xl">Link indisponível</h1><p className="mt-2 text-muted-foreground">Este link é inválido, expirou ou foi revogado. Solicite um novo acesso à Cleidson Diesel.</p></main></PublicLayout>;

  const info = orderStatusInfo(data.status as never);
  return <PublicLayout><main className="mx-auto max-w-2xl space-y-6 px-4 py-12">
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Acompanhamento do cliente · OS nº {data.number}</p>
      <h1 className="text-3xl">Olá, {data.customer_name}</h1>
      <p className="text-muted-foreground">Veja as informações liberadas pela oficina sobre seu veículo.</p>
      <StatusBadge tone={info.tone} label={info.label} className="text-sm" />
    </header>
    <section className="rounded-md border border-border p-4">
      <h2 className="font-semibold">Seu veículo</h2>
      <p className="mt-2">{data.vehicle}{data.vehicle_year ? ` · ${data.vehicle_year}` : ""}</p>
      <p className="plate text-xl">{formatPlate(data.plate)}</p>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <p><span className="text-muted-foreground">Entrada:</span> {formatDateBR(data.entry_date)}</p>
        <p><span className="text-muted-foreground">Previsão:</span> {formatDateBR(data.due_date)}</p>
      </div>
    </section>
    <section className="space-y-2 rounded-md border border-border p-4">
      <h2 className="font-semibold">Serviço solicitado</h2>
      <p className="whitespace-pre-wrap break-words">{data.complaint}</p>
      {data.diagnosis && <div className="border-t border-border pt-3"><h3 className="font-semibold">Diagnóstico liberado</h3><p className="mt-1 whitespace-pre-wrap break-words">{data.diagnosis}</p></div>}
    </section>
    <section className="flex items-start gap-3 rounded-md border border-border p-4">
      {data.status === "entregue" ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <Clock3 className="mt-0.5 size-5 text-primary" />}
      <div><h2 className="font-semibold">Última atualização</h2><p className="text-sm text-muted-foreground">{new Date(data.updated_at).toLocaleString("pt-BR")}</p></div>
    </section>
    {data.warranty && <section className="space-y-2 rounded-md border border-border p-4">
      <h2 className="font-semibold">Garantia</h2>
      <p>{data.warranty.coverage}</p>
      <p className="text-sm text-muted-foreground">De {formatDateBR(data.warranty.start_date)} até {formatDateBR(data.warranty.end_date)}</p>
      {data.warranty.terms && <p className="whitespace-pre-wrap text-sm">{data.warranty.terms}</p>}
    </section>}
    <p className="text-xs text-muted-foreground">Este link mostra somente informações desta ordem de serviço. Não compartilhe com outras pessoas.</p>
  </main></PublicLayout>;
}
