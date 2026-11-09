import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateInspectionDiagnosis } from "@/lib/inspection-diagnosis.functions";
import { diagnosisText, inspectionDiagnosisInput, type InspectionDiagnosis } from "@/lib/inspection-diagnosis";
import type { InspectionItem } from "@/lib/inspection";

export function InspectionDiagnosisAction({ vehicle, year, complaint, items, onApply }: {
  vehicle: string; year: string; complaint: string; items: InspectionItem[]; onApply: (text: string) => void;
}) {
  const generate = useServerFn(generateInspectionDiagnosis);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ fingerprint: string; result: InspectionDiagnosis } | null>(null);
  const input = { vehicle, vehicle_year: year, complaint, items: items.map(({ label, status, notes }) => ({ label, status, notes })) };
  const fingerprint = JSON.stringify(input);
  const stale = suggestion?.fingerprint !== fingerprint;
  async function analyze() {
    const parsed = inspectionDiagnosisInput.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os dados da inspeção."); return; }
    setBusy(true); setError(null); setSuggestion(null);
    try {
      const response = await generate({ data: parsed.data });
      if (response.result) setSuggestion({ fingerprint, result: response.result });
      else setError(response.error);
    } catch { setError("Não foi possível analisar a inspeção. Confira seu acesso e tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-sm uppercase text-primary">Diagnóstico por IA</h2>
      <Button type="button" variant="outline" disabled={busy} onClick={analyze}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{busy ? "Analisando inspeção…" : "Gerar diagnóstico"}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {suggestion && <div className="space-y-3" aria-live="polite">
      <p className="text-sm font-semibold">Diagnóstico preliminar — revisão do mecânico pendente</p>
      <p className="whitespace-pre-wrap text-sm">{suggestion.result.diagnosis}</p>
      <h3 className="text-sm font-semibold">Recomendações para o cliente</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">{suggestion.result.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
      {suggestion.result.checks.length > 0 && <><h3 className="text-sm font-semibold">Verificações necessárias</h3><ul className="list-disc space-y-1 pl-5 text-sm">{suggestion.result.checks.map((r, i) => <li key={i}>{r}</li>)}</ul></>}
      {stale && <p className="text-sm text-destructive">A inspeção foi alterada. Gere um novo diagnóstico antes de aplicar.</p>}
      <Button type="button" disabled={stale || busy} onClick={() => { onApply(diagnosisText(suggestion.result)); setSuggestion(null); }}><Check /> Aplicar ao diagnóstico</Button>
      <p className="text-xs text-muted-foreground">Ao salvar, o diagnóstico será incluído no orçamento do cliente. Alterações podem invalidar aprovações anteriores.</p>
    </div>}
  </div>;
}