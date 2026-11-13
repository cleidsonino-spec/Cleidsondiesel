import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateInspectionDiagnosis } from "@/lib/inspection-diagnosis.functions";
import { diagnosisText, inspectionDiagnosisInput, type InspectionDiagnosis } from "@/lib/inspection-diagnosis";

export function InspectionDiagnosisAction({ orderId, vehicle, year, complaint, failedItems, observations, onApply }: {
  orderId: string; vehicle: string; year: string; complaint: string; failedItems: string; observations: string; onApply: (text: string) => void;
}) {
  const generate = useServerFn(generateInspectionDiagnosis);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ fingerprint: string; result: InspectionDiagnosis } | null>(null);
  const input = { order_id: orderId, vehicle, vehicle_year: year, complaint, failed_items: failedItems, observations };
  const fingerprint = JSON.stringify(input);
  const stale = suggestion?.fingerprint !== fingerprint;

  async function analyze() {
    const parsed = inspectionDiagnosisInput.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os dados da inspeção.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuggestion(null);
    try {
      const response = await generate({ data: parsed.data });
      if (response.result) setSuggestion({ fingerprint, result: response.result });
      else setError(response.error);
    } catch {
      setError("Não foi possível analisar a inspeção. Confira seu acesso e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-4 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-sm uppercase text-primary">Diagnóstico preliminar com IA</h2>
        <p className="mt-1 text-sm text-muted-foreground">A IA gera apenas um resumo preliminar, com base nos dados informados.</p>
      </div>
      <Button type="button" variant="outline" disabled={busy} onClick={analyze}>
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? "Analisando…" : "Gerar diagnóstico"}
      </Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {suggestion && <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-4" aria-live="polite">
      <p className="text-sm font-semibold">Diagnóstico preliminar — sujeito à confirmação do mecânico</p>
      <p className="whitespace-pre-wrap text-sm">{suggestion.result.diagnosis}</p>
      {stale && <p className="text-sm text-destructive">Os dados da inspeção mudaram. Gere novamente antes de aplicar.</p>}
      <Button type="button" disabled={stale || busy} onClick={() => { onApply(diagnosisText(suggestion.result)); setSuggestion(null); }}>
        <Check /> Aplicar ao diagnóstico da OS
      </Button>
      <p className="text-xs text-muted-foreground">O texto só será salvo depois da sua revisão e do salvamento da ordem de serviço.</p>
    </div>}
  </div>;
}
