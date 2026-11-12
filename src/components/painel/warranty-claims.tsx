import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Plus, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { warrantiesQuery, warrantyState } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";

type Claim = {
  id: string;
  warranty_id: string;
  service_order_id: string;
  reported_at: string;
  complaint: string;
  status: "recebido" | "em_avaliacao" | "coberto" | "nao_coberto" | "concluido";
  assessment: string;
  resolution: string;
  follow_up_order_id: string | null;
  resolved_at: string | null;
};

const statusLabels: Record<Claim["status"], string> = {
  recebido: "Recebido",
  em_avaliacao: "Em avaliação",
  coberto: "Coberto pela garantia",
  nao_coberto: "Não coberto",
  concluido: "Concluído",
};

const nextStatuses: Record<Claim["status"], Claim["status"][]> = {
  recebido: ["em_avaliacao"],
  em_avaliacao: ["coberto", "nao_coberto"],
  coberto: ["concluido"],
  nao_coberto: ["concluido"],
  concluido: [],
};

export function WarrantyClaims({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const { data: warranties = [] } = useQuery(warrantiesQuery());
  const warranty = warranties.find((item) => item.service_order_id === orderId);
  const [newComplaint, setNewComplaint] = useState("");
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Partial<Claim>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const claimsQuery = useQuery({
    queryKey: ["warranty-claims", orderId],
    enabled: Boolean(warranty),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("warranty_claims")
        .select("*").eq("service_order_id", orderId).order("reported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Claim[];
    },
  });

  async function createClaim(event: FormEvent) {
    event.preventDefault();
    if (!warranty || newComplaint.trim().length < 5) return;
    setCreating(true);
    const { error } = await (supabase as any).from("warranty_claims").insert({
      warranty_id: warranty.id,
      service_order_id: orderId,
      complaint: newComplaint.trim(),
    });
    setCreating(false);
    if (error) { toast.error("Não foi possível registrar o retorno em garantia."); return; }
    setNewComplaint("");
    await qc.invalidateQueries({ queryKey: ["warranty-claims", orderId] });
    toast.success("Retorno registrado.");
  }

  async function saveClaim(claim: Claim) {
    const draft = drafts[claim.id] ?? {};
    const update = {
      status: draft.status ?? claim.status,
      assessment: draft.assessment ?? claim.assessment,
      resolution: draft.resolution ?? claim.resolution,
      follow_up_order_id: draft.follow_up_order_id === undefined ? claim.follow_up_order_id : (draft.follow_up_order_id || null),
    };
    if (update.status !== "recebido" && update.assessment.trim().length < 3) {
      toast.error("Registre a avaliação técnica antes de avançar o retorno.");
      return;
    }
    if (update.status === "concluido" && !update.resolution.trim()) {
      toast.error("Descreva a solução antes de concluir o retorno.");
      return;
    }
    setSavingId(claim.id);
    const { error } = await (supabase as any).from("warranty_claims")
      .update(update).eq("id", claim.id);
    setSavingId(null);
    if (error) { toast.error("Não foi possível atualizar o retorno."); return; }
    setDrafts((current) => { const next = { ...current }; delete next[claim.id]; return next; });
    await qc.invalidateQueries({ queryKey: ["warranty-claims", orderId] });
    toast.success("Retorno atualizado.");
  }

  if (!warranty) return null;
  const warrantyStatus = warrantyState(warranty.start_date, warranty.end_date, todayISO());

  return <section className="space-y-4 border-t border-border pt-6 print:hidden">
    <div className="flex items-center gap-2"><ShieldCheck className="text-primary" /><h2 className="text-xl font-semibold">Retornos em garantia</h2></div>
    <p className="text-sm text-muted-foreground">Garantia {warrantyStatus.toLocaleLowerCase()} · válida de {formatDateBR(warranty.start_date)} até {formatDateBR(warranty.end_date)}. Registre aqui reclamações e avaliações relacionadas a esta garantia.</p>
    <form onSubmit={(event) => void createClaim(event)} className="space-y-3 rounded-md border border-border p-4">
      <Label htmlFor="warranty-claim-complaint">Motivo do retorno</Label>
      <Textarea id="warranty-claim-complaint" required minLength={5} maxLength={5000} value={newComplaint} onChange={(event) => setNewComplaint(event.target.value)} placeholder="Descreva o problema relatado pelo cliente…" />
      <Button type="submit" disabled={creating || newComplaint.trim().length < 5}>{creating ? <Loader2 className="animate-spin" /> : <Plus />} Registrar retorno</Button>
    </form>
    {claimsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando retornos…</p>}
    {claimsQuery.isError && <p className="text-sm text-destructive">Não foi possível carregar os retornos desta garantia.</p>}
    {(claimsQuery.data ?? []).map((claim) => {
      const draft = drafts[claim.id] ?? {};
      const value = <K extends keyof Claim>(key: K) => (draft[key] ?? claim[key]) as Claim[K];
      const locked = claim.status === "concluido";
      const allowedStatuses = [claim.status, ...nextStatuses[claim.status]];
      return <article key={claim.id} className="space-y-3 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Recebido em {new Date(claim.reported_at).toLocaleString("pt-BR")}</p>
          <span className="rounded-full border border-border px-3 py-1 text-xs">{statusLabels[claim.status]}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{claim.complaint}</p>
        <div className="grid gap-3">
          <div className="space-y-1"><Label>Status</Label><Select disabled={locked} value={value("status")} onValueChange={(status) => setDrafts((current) => ({ ...current, [claim.id]: { ...current[claim.id], status: status as Claim["status"] } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allowedStatuses.map((status) => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-1"><Label>Avaliação técnica</Label><Textarea disabled={locked} value={String(value("assessment") ?? "")} onChange={(event) => setDrafts((current) => ({ ...current, [claim.id]: { ...current[claim.id], assessment: event.target.value } }))} /></div>
        <div className="space-y-1"><Label>Solução / providência</Label><Textarea disabled={locked} value={String(value("resolution") ?? "")} onChange={(event) => setDrafts((current) => ({ ...current, [claim.id]: { ...current[claim.id], resolution: event.target.value } }))} /></div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {claim.resolved_at && <p className="text-xs text-muted-foreground">Concluído em {new Date(claim.resolved_at).toLocaleString("pt-BR")}</p>}
          {!locked && <Button type="button" size="sm" disabled={savingId === claim.id} onClick={() => void saveClaim(claim)}>{savingId === claim.id ? <Loader2 className="animate-spin" /> : <Save />} Salvar retorno</Button>}
        </div>
      </article>;
    })}
    {claimsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum retorno registrado para esta garantia.</p>}
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><AlertCircle className="size-4 shrink-0" />Retornos concluídos ficam bloqueados para edição. Para um novo problema, registre outro retorno, mantendo o histórico anterior.</p>
  </section>;
}
