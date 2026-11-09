import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateInspectionDiagnosis } from "@/lib/inspection-diagnosis.functions";
import { diagnosisText, inspectionDiagnosisInput, type InspectionDiagnosis } from "@/lib/inspection-diagnosis";

export function InspectionDiagnosisAction({ vehicle, year, complaint, failedItems, observations, onApply }: {
  vehicle: string; year: string; complaint: string; failedItems: string; observations: string; onApply: (text: string) => void;
}) {
  const generate = useServerFn(generateInspectionDiagnosis);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ fingerprint: string; result: InspectionDiagnosis } | null>(null);
  const input = { vehicle, vehicle_year: year, complaint, failed_items: failedItems, observations };
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
        <h2 className="font-display text-sm uppercase text-primary">Diagnóstico com inteligência artificial</h2>
        <p className="mt-1 text-sm text-muted-foreground">Gere uma explicação clara e recomendações com base no que foi informado.</p>
      </div>
      <Button type="button" variant="outline" disabled={busy} onClick={analyze}>
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? "Analisando…" : "Gerar diagnóstico"}
      </Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {suggestion && <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-4" aria-live="polite">
      <p className="text-sm font-semibold">Diagnóstico preliminar — revisão do mecânico pendente</p>
      <p className="whitespace-pre-wrap text-sm">{suggestion.result.diagnosis}</p>
      <h3 className="text-sm font-semibold">Recomendações para o cliente</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">{suggestion.result.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
      {suggestion.result.checks.length > 0 && <>
        <h3 className="text-sm font-semibold">Verificações necessárias</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">{suggestion.result.checks.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </>}
      {stale && <p className="text-sm text-destructive">Os dados da inspeção mudaram. Gere novamente antes de aplicar.</p>}
      <Button type="button" disabled={stale || busy} onClick={() => { onApply(diagnosisText(suggestion.result)); setSuggestion(null); }}>
        <Check /> Aplicar ao diagnóstico da OS
      </Button>
      <p className="text-xs text-muted-foreground">A sugestão só será salva depois da revisão e do salvamento da ordem de serviço.</p>
    </div>}
  </div>;
}
