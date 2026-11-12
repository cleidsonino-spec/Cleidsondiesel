import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BellRing, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";

import { OrderForm, type OrderFormValues } from "@/components/painel/order-form";
import { QuotePdfActions } from "@/components/painel/quote-pdf-actions";
import { ApprovalActions } from "@/components/painel/approval-actions";
import { CustomerAuthorizationActions } from "@/components/painel/customer-authorization-actions";
import { CustomerPortalActions } from "@/components/painel/customer-portal-actions";
import { WarrantyEditor } from "@/components/painel/warranty-editor";
import { MechanicAssignment } from "@/components/painel/mechanic-assignment";
import { ServiceOrderStatusHistory } from "@/components/painel/service-order-status-history";
import { warrantiesQuery } from "@/lib/warranty";
import { StatusBadge } from "@/components/site/status-badge";
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
  loader: async ({ context, params }) => { await Promise.all([context.queryClient.ensureQueryData(orderQuery(params.id)), context.queryClient.ensureQueryData(warrantiesQuery())]); },
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
  const { isAdmin, isSecretary } = Route.useRouteContext();
  const { id } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQuery(id));
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

  const info = orderStatusInfo(order.status);
  const quoteText = quoteMessage(order);
  const statusHref = waLink(order.phone, statusMessage(order));



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

      {/* WhatsApp */}
      <ApprovalActions order={order} />
      {(isAdmin || isSecretary) && <CustomerAuthorizationActions orderId={order.id} orderStatus={order.status} />}
      {(isAdmin || isSecretary) && <CustomerPortalActions orderId={order.id} orderNumber={order.number} phone={order.phone} orderStatus={order.status} />}
      {(isAdmin || isSecretary) && ((order as any).fuel_filter_replacement !== null || (order as any).system_cleaning !== null) && <section className="rounded-md border border-primary/30 bg-primary/5 p-4">
        <h2 className="font-semibold">Recomendações do mecânico para o orçamento</h2>
        <p className="mb-3 text-xs text-muted-foreground">Respostas registradas durante o diagnóstico.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="text-sm text-muted-foreground">Troca dos filtros de combustível</p><p className="font-semibold">{(order as any).fuel_filter_replacement === null ? "Não informado" : (order as any).fuel_filter_replacement ? "Sim — incluir no orçamento" : "Não"}</p></div>
          <div><p className="text-sm text-muted-foreground">Limpeza do sistema</p><p className="font-semibold">{(order as any).system_cleaning === null ? "Não informado" : (order as any).system_cleaning ? "Sim — incluir no orçamento" : "Não"}</p></div>
        </div>
      </section>}
      {(isAdmin || isSecretary) && order.status === "recebido" && <MechanicAssignment serviceOrderId={id} stage="diagnostico" />}
      {(isAdmin || isSecretary) && String(order.status) === "aprovado_aguardando_encaminhamento" && <MechanicAssignment serviceOrderId={id} stage="servico" />}
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
          allowStatusEdit={false}
          onSubmit={async (input) => {
            // O status só pode mudar pelas RPCs e validações do fluxo da OS.
            // A edição administrativa atualiza apenas os demais campos.
            const editableFields = { ...input };
            delete editableFields.status;
            const { error } = await supabase.from("service_orders").update(editableFields).eq("id", id);
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
              {isAdmin && (
                <p className="text-sm text-muted-foreground sm:ml-auto" role="status">
                  Exclusão física desativada para preservar o histórico da OS. O cancelamento seguro será disponibilizado após a operação autorizada no banco.
                </p>
              )}
            </>
          }
        />
      </div>

      {(isAdmin || isSecretary) && <ServiceOrderStatusHistory orderId={id} />}
      <WarrantyEditor orderId={id} orderStatus={order.status} canManage={isAdmin || isSecretary} />
      <PrintSheet order={order} />
    </div>
  );
}

function PrintSheet({ order: o }: { order: Order }) {
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
      <div className="mt-16 grid grid-cols-2 gap-10 text-center">
        <p className="border-t border-foreground pt-1">Assinatura do cliente</p>
        <p className="border-t border-foreground pt-1">Cleidson Diesel</p>
      </div>
    </div>
  );
}
