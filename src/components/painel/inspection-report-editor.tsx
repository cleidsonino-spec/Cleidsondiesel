import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Save, Send, Share2, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { InspectionDiagnosisAction } from "@/components/painel/inspection-diagnosis";
import {
  createInspectionReportPdf,
  downloadInspectionReport,
  type InspectionReportData,
  type InspectionReportOrder,
} from "@/lib/inspection-report-pdf";

type ReportRecord = InspectionReportData & {
  id: string;
  status: "draft" | "pending_review" | "approved" | "returned";
  review_note: string;
  submitted_at: string | null;
  reviewed_at: string | null;
};
type Props = {
  order: InspectionReportOrder & { id: string; complaint: string };
  isAdmin: boolean;
  isSecretary: boolean;
};

const emptyReport: InspectionReportData = {
  diagnosis: "",
  executed_parts: "",
  rejected_items: "",
  inspection_observations: "",
};
const fields: { key: keyof InspectionReportData; label: string; placeholder: string }[] = [
  { key: "diagnosis", label: "Diagnóstico", placeholder: "Descreva o diagnóstico técnico e os defeitos encontrados..." },
  { key: "executed_parts", label: "Peças e serviços executados", placeholder: "Informe as peças substituídas, reparadas e os serviços realizados..." },
  { key: "rejected_items", label: "Itens reprovados", placeholder: "Informe os componentes que foram reprovados na inspeção..." },
  { key: "inspection_observations", label: "Observações da inspeção", placeholder: "Registre observações e recomendações técnicas..." },
];
const statusLabels = {
  draft: "Em preenchimento",
  pending_review: "Aguardando revisão",
  approved: "Aprovado",
  returned: "Devolvido para correção",
};

export function InspectionReportEditor({ order, isAdmin, isSecretary }: Props) {
  const manager = isAdmin || isSecretary;
  const [report, setReport] = useState<InspectionReportData>(emptyReport);
  const [record, setRecord] = useState<ReportRecord | null>(null);
  const [isAssignedMechanic, setIsAssignedMechanic] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    let active = true;
    async function loadReport() {
      try {
        const [result, assigned] = await Promise.all([
          (supabase as any).from("service_order_inspection_reports")
            .select("id, diagnosis, executed_parts, rejected_items, inspection_observations, status, review_note, submitted_at, reviewed_at")
            .eq("service_order_id", order.id).maybeSingle(),
          supabase.rpc("is_mechanic_assigned", { _order_id: order.id }),
        ]);
        if (!active) return;
        if (result.error) toast.error(`Não foi possível carregar o relatório: ${result.error.message}`);
        else if (result.data) {
          setRecord(result.data as ReportRecord);
          setReport({
            diagnosis: result.data.diagnosis ?? "",
            executed_parts: result.data.executed_parts ?? "",
            rejected_items: result.data.rejected_items ?? "",
            inspection_observations: result.data.inspection_observations ?? "",
          });
          setReviewNote(result.data.review_note ?? "");
        }
        if (assigned.error) {
          console.error("[InspectionReport] Falha ao verificar mecânico atribuído.", assigned.error);
        } else {
          setIsAssignedMechanic(Boolean(assigned.data));
        }
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Não foi possível carregar o relatório técnico.");
      } finally {
        if (active) setLoaded(true);
      }
    }
    void loadReport();
    return () => { active = false; };
  }, [order.id]);

  const canEdit = (manager && record?.status !== "approved") || (isAssignedMechanic && (!record || record.status === "draft" || record.status === "returned"));
  const canReview = manager && record?.status === "pending_review";
  const canEmit = manager && record?.status === "approved";

  async function persist(status: ReportRecord["status"]) {
    setBusy(true);
    const payload = {
      service_order_id: order.id,
      ...report,
      status,
      ...(record ? {} : { created_by: (await supabase.auth.getUser()).data.user?.id ?? null }),
    };
    const { data, error } = await (supabase as any).from("service_order_inspection_reports")
      .upsert(payload, { onConflict: "service_order_id" })
      .select("id, diagnosis, executed_parts, rejected_items, inspection_observations, status, review_note, submitted_at, reviewed_at")
      .single();
    setBusy(false);
    if (error) {
      toast.error(`Não foi possível salvar: ${error.message}`);
      return false;
    }
    setRecord(data as ReportRecord);
    toast.success(status === "pending_review" ? "Relatório enviado para revisão." : "Relatório salvo.");
    return true;
  }

  async function review(status: "approved" | "returned") {
    if (!record) return;
    setBusy(true);
    const { data, error } = await (supabase as any).from("service_order_inspection_reports")
      .update({ ...report, status, review_note: status === "returned" ? reviewNote : "" })
      .eq("id", record.id)
      .select("id, diagnosis, executed_parts, rejected_items, inspection_observations, status, review_note, submitted_at, reviewed_at")
      .single();
    setBusy(false);
    if (error) {
      toast.error(`Não foi possível concluir a revisão: ${error.message}`);
      return;
    }
    setRecord(data as ReportRecord);
    toast.success(status === "approved" ? "Relatório aprovado. PDF liberado." : "Relatório devolvido para correção.");
  }

  async function emitPdf(share: boolean) {
    if (!canEmit) return;
    setBusy(true);
    try {
      // O banco valida o perfil e devolve apenas o conteúdo do relatório aprovado.
      const { data: approvedData, error: authorizationError } = await (supabase as any)
        .rpc("get_approved_inspection_report_for_pdf", { _service_order_id: order.id });
      if (authorizationError || !approvedData) {
        throw new Error(authorizationError?.message ?? "Relatório aprovado não disponível para emissão.");
      }
      const file = await createInspectionReportPdf(order, approvedData as InspectionReportData);
      if (!share) {
        downloadInspectionReport(file);
      } else if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Relatório técnico OS ${order.number} — Cleidson Diesel`,
          text: `Olá, ${order.customer_name}! Segue o relatório técnico da sua ordem de serviço.`,
        });
      } else {
        downloadInspectionReport(file);
        toast.message("PDF baixado. Anexe o arquivo ao enviar pelo WhatsApp.");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <section className="rounded-md border p-4 text-sm text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Carregando relatório técnico...</section>;
  if (!manager && !isAssignedMechanic && !record) return null;

  return (
    <section className="space-y-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base uppercase">Relatório técnico de inspeção</h2>
          <p className="mt-1 text-sm text-muted-foreground">Documento opcional vinculado à OS nº {order.number}. Não integra o orçamento.</p>
        </div>
        {record && <span className="rounded-full border px-3 py-1 text-xs font-medium">{statusLabels[record.status]}</span>}
      </div>

      <div className="grid gap-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`inspection-report-${field.key}`}>{field.label} <span className="text-muted-foreground">(opcional)</span></Label>
            <Textarea
              id={`inspection-report-${field.key}`}
              value={report[field.key]}
              readOnly={!canEdit}
              onChange={(event) => setReport((current) => ({ ...current, [field.key]: event.target.value }))}
              placeholder={field.placeholder}
              rows={4}
              maxLength={12000}
            />
          </div>
        ))}
      </div>

      {(manager || isAssignedMechanic) && canEdit && (
        <InspectionDiagnosisAction
          orderId={order.id}
          vehicle={order.vehicle}
          year={order.vehicle_year ?? ""}
          complaint={order.complaint}
          failedItems={report.rejected_items}
          observations={report.inspection_observations}
          onApply={(text) => setReport((current) => ({ ...current, diagnosis: text }))}
        />
      )}
      {record?.status === "returned" && record.review_note && (
        <div className="rounded-md border border-destructive/40 p-3 text-sm">
          <strong>Orientação da revisão:</strong> {record.review_note}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => persist("draft")} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />} Salvar rascunho
          </Button>
          <Button type="button" onClick={() => persist("pending_review")} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Enviar para revisão
          </Button>
        </div>
      )}

      {canReview && (
        <div className="space-y-3 rounded-md bg-secondary/40 p-3">
          <div>
            <Label htmlFor="inspection-review-note">Orientação para correção (se devolver)</Label>
            <Textarea id="inspection-review-note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} maxLength={4000} placeholder="Explique o que precisa ser corrigido..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => review("approved")} disabled={busy}>
              <CheckCircle2 /> Aprovar relatório
            </Button>
            <Button type="button" variant="outline" onClick={() => review("returned")} disabled={busy}>
              <RotateCcw /> Devolver para correção
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A aprovação de uma pessoa da administração ou da secretaria é suficiente.</p>
        </div>
      )}

      {canEmit && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" onClick={() => emitPdf(false)} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />} Gerar / baixar PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => emitPdf(true)} disabled={busy}>
            <Share2 /> Compartilhar PDF
          </Button>
        </div>
      )}

      {record?.status === "approved" && !manager && (
        <p className="text-sm text-muted-foreground"><FileText className="mr-1 inline size-4" />Relatório aprovado. A emissão do PDF é exclusiva da administração e secretaria.</p>
      )}
      <p className="text-xs text-muted-foreground">O relatório não é obrigatório e nunca é anexado automaticamente ao orçamento.</p>
    </section>
  );
}
