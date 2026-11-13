import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Save, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  createInspectionReportPdf,
  downloadInspectionReport,
  type InspectionReportData,
  type InspectionReportOrder,
} from "@/lib/inspection-report-pdf";

type Props = {
  order: InspectionReportOrder & { id: string };
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

export function InspectionReportEditor({ order }: Props) {
  const [report, setReport] = useState<InspectionReportData>(emptyReport);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from("service_order_inspection_reports")
      .select("diagnosis, executed_parts, rejected_items, inspection_observations")
      .eq("service_order_id", order.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error(`Não foi possível carregar o relatório: ${error.message}`);
        } else if (data) {
          setReport({
            diagnosis: data.diagnosis ?? "",
            executed_parts: data.executed_parts ?? "",
            rejected_items: data.rejected_items ?? "",
            inspection_observations: data.inspection_observations ?? "",
          });
          setExists(true);
        }
        setLoaded(true);
      });
    return () => { active = false; };
  }, [order.id]);

  async function save() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      service_order_id: order.id,
      ...report,
      ...(exists ? {} : { created_by: userData.user?.id ?? null }),
    };
    const { error } = await supabase.from("service_order_inspection_reports")
      .upsert(payload, { onConflict: "service_order_id" });
    setSaving(false);
    if (error) {
      toast.error(`Não foi possível salvar o relatório: ${error.message}`);
      return false;
    }
    setExists(true);
    toast.success("Relatório técnico salvo na ordem de serviço.");
    return true;
  }

  async function getPdf() {
    if (!exists) {
      const saved = await save();
      if (!saved) return null;
    }
    setGenerating(true);
    try {
      const file = await createInspectionReportPdf(order, report);
      setGenerating(false);
      return file;
    } catch (error) {
      setGenerating(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
      return null;
    }
  }

  async function download() {
    const file = await getPdf();
    if (file) downloadInspectionReport(file);
  }

  async function share() {
    const file = await getPdf();
    if (!file) return;
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      downloadInspectionReport(file);
      toast.message("PDF baixado. Anexe o arquivo ao enviar pelo WhatsApp.");
      return;
    }
    try {
      await navigator.share({
        files: [file],
        title: `Relatório técnico OS ${order.number} — Cleidson Diesel`,
        text: `Olá, ${order.customer_name}! Segue o relatório técnico da sua ordem de serviço.`,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o PDF. Tente baixá-lo.");
    }
  }

  if (!loaded) return <section className="rounded-md border p-4 text-sm text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Carregando relatório técnico...</section>;

  return (
    <section className="space-y-4 rounded-md border border-border p-4">
      <div>
        <h2 className="font-display text-base uppercase">Relatório técnico de inspeção</h2>
        <p className="mt-1 text-sm text-muted-foreground">Documento opcional vinculado à OS nº {order.number}. Não faz parte do orçamento.</p>
      </div>
      <div className="grid gap-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`inspection-report-${field.key}`}>{field.label} <span className="text-muted-foreground">(opcional)</span></Label>
            <Textarea
              id={`inspection-report-${field.key}`}
              value={report[field.key]}
              onChange={(event) => setReport((current) => ({ ...current, [field.key]: event.target.value }))}
              placeholder={field.placeholder}
              rows={4}
              maxLength={12000}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" onClick={save} disabled={saving || generating}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Salvar relatório
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={download} disabled={saving || generating}>
          {generating ? <Loader2 className="animate-spin" /> : <Download />} Gerar / baixar PDF
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={share} disabled={saving || generating}>
          <Share2 /> Compartilhar PDF
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">O relatório só será salvo e emitido quando você usar uma das ações acima. Ele não é anexado ao orçamento.</p>
    </section>
  );
}
