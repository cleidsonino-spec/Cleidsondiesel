import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BellRing, MessageCircle, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { OrderForm, type OrderFormValues } from "@/components/painel/order-form";
import { QuotePdfActions } from "@/components/painel/quote-pdf-actions";
import { ApprovalActions } from "@/components/painel/approval-actions";
import { WarrantyEditor } from "@/components/painel/warranty-editor";
import { StaffOrderTools } from "@/components/painel/staff-order-tools";
import { warrantiesQuery } from "@/lib/warranty";
import { StatusBadge } from "@/components/site/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatPlate } from "@/lib/plate";
import { readPartItems } from "@/lib/parts";
import { readInspectionData } from "@/lib/inspection";
import { orderQuery } from "@/lib/queries";
import { formatDateBR } from "@/lib/schedule";
import { formatBRL, orderStatusInfo, orderTotal } from "@/lib/status";
import { quoteMessage, statusMessage, waLink } from "@/lib/whatsapp";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];

export const Route = createFileRoute("/_authenticated/painel/ordens/$id")({
  head: () => ({ meta: [
    { title: "Editar ordem de serviço — Cleidson Diesel" },
    { name: "description", content: "Consulte e atualize a ordem de serviço na Cleidson Diesel." },
    { property: "og:title", content: "Editar ordem de serviço — Cleidson Diesel" },
    { property: "og:description", content: "Peças, orçamento e acompanhamento da ordem de serviço." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: async ({ context, params }) => {
    if (context.isMechanic) return context.queryClient.ensureQueryData(orderQuery(params.id));
    await Promise.all([context.queryClient.ensureQueryData(orderQuery(params.id)), context.queryClient.ensureQueryData(warrantiesQuery())]);
  },
  component: OrdemPage,
});

function toForm(o: Order): OrderFormValues {
  const money = (n: number) => (Number(n) ? Number(n).toFixed(2).replace(".", ",") : "");
  return {
    customer_id: o.customer_id ?? "",
    vehicle_id: o.vehicle_id ?? "",
    plate: o.plate,
    customer_name: o.customer_name,
    phone: o.phone ?? "",
    vehicle: o.vehicle,
    vehicle_year: o.vehicle_year ?? "",
    mileage: o.mileage ?? "",
    complaint: o.complaint,
    diagnosis: o.diagnosis ?? "",
    parts: o.parts ?? "",
    part_items: o.part_items == null
      ? (Number(o.parts_value) ? [{ description: o.parts || "Peças (valor anterior)", quantity: "1", unit_value: money(o.parts_value) }] : [{ description: "", quantity: "1", unit_value: "" }])
      : readPartItems(o.part_items).map((item) => ({ description: item.description, quantity: String(item.quantity), unit_value: money(item.unit_value) })),
    labor_value: money(o.labor_value),
    status: o.status,
    entry_date: o.entry_date,
    due_date: o.due_date ?? "",
    notes: o.notes ?? "",
    inspection: readInspectionData(o.inspection_checklist),
  };
}

function OrdemPage() {
  const { id } = Route.useParams();
  const { isMechanic } = Route.useRouteContext();
  const { data: order } = useSuspenseQuery(orderQuery(id));
  const { data: verifiedProcedures = [] } = useQuery({
    queryKey: ["verified-procedures", id],
    enabled: !isMechanic && Boolean(order),
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client.from("verified_service_procedures")
        .select("id,procedure,description,result,observations,created_at")
        .eq("service_order_id", id).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const qc = useQueryClient();
  const navigate = useNavigate();

  if (!order) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Ordem de serviço não encontrada.</p>
        <Link to="/painel" className="mt-4 inline-block text-primary hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  if (isMechanic) return <MechanicOrderView order={order} />;

  const info = orderStatusInfo(order.status);
  const siteUrl = typeof window !== "undefined" ? window.location.origin : undefined;
  const quoteText = quoteMessage(order);
  const statusHref = waLink(order.phone, statusMessage(order, siteUrl));

  async function remove() {
    const { error } = await supabase.from("service_orders").delete().eq("id", id);
    if (error) { toast.error("Não foi possível excluir."); return; }
    await qc.invalidateQueries({ queryKey: ["orders"] });
    toast.success("OS excluída.");
    navigate({ to: "/painel" });
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link to="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Ordens de serviço
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">OS nº {order.number}</p>
            <h1 className="plate text-3xl md:text-4xl">{formatPlate(order.plate)}</h1>
          </div>
          <StatusBadge tone={info.tone} label={info.label} className="text-sm" />
        </div>
      </div>

      {<StaffOrderTools orderId={id} />}

      {/* WhatsApp */}
      <ApprovalActions order={order} />
      <div className="rounded-md border border-success/40 bg-success/10 p-4 print:hidden">
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle className="size-5 text-success" />
          <p className="font-display text-sm uppercase">WhatsApp do cliente</p>
        </div>
        <div className="mb-3 flex flex-wrap gap-2"><QuotePdfActions order={order} message={quoteText} /></div>
        {statusHref ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="h-11">
              <a href={statusHref} target="_blank" rel="noopener noreferrer">
                <BellRing /> Avisar status: {info.label}
              </a>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Cadastre um telefone com DDD na OS para enviar avisos e orçamentos pelo WhatsApp.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Salve as alterações antes de enviar, para a mensagem sair atualizada.</p>
      </div>

      <div className="print:hidden">
        <OrderForm
          key={order.updated_at}
          initial={toForm(order)}
          submitLabel="Salvar alterações"
          onSubmit={async (input) => {
            const { error } = await supabase.from("service_orders").update(input).eq("id", id);
            if (error) {
              console.error("Erro ao atualizar OS:", error);
              toast.error(`Falha ao salvar: ${error.message}`);
              return;
            }
            await qc.invalidateQueries({ queryKey: ["orders"] });
            toast.success("OS atualizada.");
          }}
          extraActions={
            <>
              <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => window.print()}>
                <Printer /> Imprimir OS
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="lg" className="h-12 text-destructive sm:ml-auto">
                    <Trash2 /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir OS nº {order.number}?</AlertDialogTitle>
                    <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          }
        />
      </div>

      <WarrantyEditor orderId={id} orderStatus={order.status} />
      <PrintSheet order={order} verifiedProcedures={verifiedProcedures} />
    </div>
  );
}

function MechanicOrderView({ order }: { order: Order }) {
  const info = orderStatusInfo(order.status);
  return (
    <div className="space-y-5">
      <div><Link to="/painel" className="text-sm text-muted-foreground hover:text-foreground">← Voltar às minhas OS</Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Ordem atribuída · nº {order.number}</p><h1 className="plate text-3xl">{formatPlate(order.plate)}</h1></div><StatusBadge tone={info.tone} label={info.label} /></div>
      </div>
      <section className="grid gap-4 rounded-md border border-border bg-card p-4 sm:grid-cols-2">
        <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{order.customer_name}</p></div>
        <div><p className="text-xs text-muted-foreground">Veículo</p><p className="font-medium">{order.vehicle} {order.vehicle_year ?? ""}</p></div>
        <div><p className="text-xs text-muted-foreground">Entrada</p><p>{formatDateBR(order.entry_date)}</p></div>
        <div><p className="text-xs text-muted-foreground">Previsão</p><p>{formatDateBR(order.due_date)}</p></div>
        <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Serviço solicitado</p><p className="whitespace-pre-wrap">{order.complaint}</p></div>
        {order.diagnosis && <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Diagnóstico</p><p className="whitespace-pre-wrap">{order.diagnosis}</p></div>}
        {order.parts && <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Peças / serviços informados</p><p className="whitespace-pre-wrap">{order.parts}</p></div>}
        {order.notes && <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Observações</p><p className="whitespace-pre-wrap">{order.notes}</p></div>}
      </section>
      <p className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">Para registrar o que foi executado, volte ao painel e use o botão <strong>Registrar procedimento</strong> na OS. O registro será enviado para conferência e não altera os valores nem a OS oficial.</p>
    </div>
  );
}

function PrintSheet({ order: o, verifiedProcedures }: { order: Order; verifiedProcedures: { id: string; procedure: string; description: string; result: string | null; observations: string | null; created_at: string }[] }) {
  const rows: [string, string | null][] = [
    ["Cliente", o.customer_name],
    ["Telefone", o.phone],
    ["Veículo", [o.vehicle, o.vehicle_year].filter(Boolean).join(" · ")],
    ["Placa", formatPlate(o.plate)],
    ["Km", o.mileage],
    ["Entrada", formatDateBR(o.entry_date)],
    ["Previsão", formatDateBR(o.due_date)],
    ["Status", orderStatusInfo(o.status).label],
  ];
  return (
    <div className="hidden text-sm print:block">
      <div className="flex items-end justify-between border-b-2 border-foreground pb-3">
        <div>
          <p className="font-display text-2xl uppercase">Cleidson Diesel</p>
          <p className="text-muted-foreground">Bomba injetora e injeção diesel</p>
        </div>
        <p className="font-display text-xl">OS nº {o.number}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
        {rows.map(([k, v]) => (
          <p key={k}>
            <strong>{k}:</strong> {v || "—"}
          </p>
        ))}
      </div>
      {(
        [
          ["Reclamação", o.complaint],
          ["Diagnóstico", o.diagnosis],
          ["Peças e serviços", o.parts],
        ] as [string, string | null][]
      ).map(([k, v]) => (
        <div key={k} className="mt-4">
          <p className="font-bold">{k}</p>
          <p className="whitespace-pre-wrap">{v || "—"}</p>
        </div>
      ))}
      {(() => {
        const inspection = readInspectionData(o.inspection_checklist);
        return inspection.failedItems || inspection.observations ? <div className="mt-4 space-y-2">
          <p className="font-bold">Inspeção</p>
          {inspection.failedItems && <div><p className="font-semibold">Itens reprovados</p><p className="whitespace-pre-wrap">{inspection.failedItems}</p></div>}
          {inspection.observations && <div><p className="font-semibold">Observações da inspeção</p><p className="whitespace-pre-wrap">{inspection.observations}</p></div>}
        </div> : null;
      })()}
      {readPartItems(o.part_items).length > 0 && <table className="mt-4 w-full text-left">
        <thead><tr className="border-b border-foreground"><th className="py-2">Peça</th><th className="py-2 text-right">Qtd.</th><th className="py-2 text-right">Unitário</th><th className="py-2 text-right">Total</th></tr></thead>
        <tbody>{readPartItems(o.part_items).map((item, index) => <tr key={index}><td className="py-1">{item.description}</td><td className="text-right">{item.quantity}</td><td className="text-right">{formatBRL(item.unit_value)}</td><td className="text-right">{formatBRL(item.value)}</td></tr>)}</tbody>
      </table>}
      <div className="mt-6 ml-auto w-64 space-y-1 border-t border-foreground pt-2">
        <p className="flex justify-between">
          <span>Peças</span> <span>{formatBRL(Number(o.parts_value))}</span>
        </p>
        <p className="flex justify-between">
          <span>Mão de obra</span> <span>{formatBRL(Number(o.labor_value))}</span>
        </p>
        <p className="flex justify-between text-base font-bold">
          <span>Total</span> <span>{formatBRL(orderTotal(o.parts_value, o.labor_value))}</span>
        </p>
      </div>
      {verifiedProcedures.length > 0 && <div className="mt-6">
        <p className="mb-2 font-bold">Procedimentos técnicos conferidos</p>
        {verifiedProcedures.map((item, index) => <div key={item.id} className="mb-3 border-b border-foreground/30 pb-2">
          <p className="font-semibold">{index + 1}. {item.procedure.replaceAll("_", " ")}</p>
          <p className="whitespace-pre-wrap">{item.description}</p>
          {item.result && <p><strong>Resultado:</strong> {item.result}</p>}
          {item.observations && <p className="whitespace-pre-wrap"><strong>Observações:</strong> {item.observations}</p>}
        </div>)}
      </div>}
      <div className="mt-16 grid grid-cols-2 gap-10 text-center">
        <p className="border-t border-foreground pt-1">Assinatura do cliente</p>
        <p className="border-t border-foreground pt-1">Cleidson Diesel</p>
      </div>
    </div>
  );
}
