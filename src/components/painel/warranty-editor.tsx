import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil, Plus, Save, ShieldCheck, Printer, History, Wrench, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { warrantiesQuery, warrantyEndDate, warrantyState, canIssueWarranty } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";

type WarrantyDraft = { id?: string; start: string; months: string; coverage: string; terms: string };
type ReturnDraft = { id?: string; complaint: string; diagnosis: string; resolution: string; parts_used: string; labor_description: string; status: string };
const returnLabels: Record<string, string> = {
  received: "Recebido",
  in_review: "Em análise",
  resolved: "Resolvido",
  not_covered: "Fora da cobertura",
};

export function WarrantyEditor({ orderId, orderStatus, canManage }: { orderId: string; orderStatus: string; canManage: boolean }) {
  const { data } = useSuspenseQuery(warrantiesQuery());
  const list = data.filter((w) => w.service_order_id === orderId);
  const canIssue = canIssueWarranty(orderStatus);
  const [draft, setDraft] = useState<WarrantyDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.id && !canIssue) { toast.error("A garantia só pode ser emitida quando a OS estiver pronta para retirada."); return; }
    const end = warrantyEndDate(draft.start, Number(draft.months));
    if (!end || !draft.coverage.trim()) { toast.error("Informe data, prazo de 1 a 120 meses e serviços cobertos."); return; }
    setSaving(true);
    try {
      const input = { service_order_id: orderId, duration_months: Number(draft.months), end_date: end, coverage: draft.coverage.trim(), terms: draft.terms.trim() };
      const { error } = draft.id
        ? await supabase.from("warranties").update(input).eq("id", draft.id)
        : await supabase.from("warranties").insert({ ...input, start_date: draft.start });
      if (error) { toast.error(error.code === "23505" ? "Esta OS já possui uma garantia emitida." : "Não foi possível salvar a garantia."); return; }
      await qc.invalidateQueries({ queryKey: ["warranties"] });
      setDraft(null);
      toast.success("Garantia salva. A alteração ficou registrada no histórico.");
    } finally { setSaving(false); }
  }

  return <section className="space-y-4 border-t border-border pt-6 print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl"><ShieldCheck className="text-primary" />Garantia da OS</h2>
      <Button type="button" variant="outline" disabled={!canManage || !canIssue || list.length > 0} onClick={() => setDraft({ start: todayISO(), months: "", coverage: "", terms: "" })}><Plus />Emitir garantia</Button>
    </div>
    {!canIssue && list.length === 0 && <p className="text-sm text-muted-foreground">A garantia será liberada somente quando a OS estiver com status “Pronto p/ retirada”.</p>}
    {list.length === 0 && !draft && canIssue && <p className="text-sm text-muted-foreground">Nenhuma garantia emitida.</p>}
    {list.map((w) => <div key={w.id} className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{warrantyState(w.start_date, w.end_date, todayISO())} · {w.duration_months} meses</p>
          <p className="text-sm text-muted-foreground">{formatDateBR(w.start_date)} a {formatDateBR(w.end_date)}</p>
          <p className="whitespace-pre-wrap text-sm">{w.coverage || "Cobertura não informada"}</p>
        </div>
        <div className="flex gap-1">
          <Button asChild variant="outline" size="sm"><Link to="/painel/garantias/$id" params={{ id: w.id }}><Printer />Certificado</Link></Button>
          {canManage && <Button type="button" variant="ghost" size="icon" title="Editar garantia" aria-label="Editar garantia" onClick={() => setDraft({ id: w.id, start: w.start_date, months: String(w.duration_months), coverage: w.coverage, terms: w.terms })}><Pencil /></Button>}
        </div>
      </div>
      {canManage && <><WarrantyAudit warrantyId={w.id} /><WarrantyReturnPanel warrantyId={w.id} canManage={canManage} /></>}
    </div>)}
    {draft && canManage && <form onSubmit={save} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="warranty-start">Início da garantia</Label><Input id="warranty-start" required type="date" value={draft.start} disabled={Boolean(draft.id)} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="warranty-months">Prazo (meses)</Label><Input id="warranty-months" required type="number" min={1} max={120} step={1} value={draft.months} onChange={(e) => setDraft({ ...draft, months: e.target.value })} /></div>
      <p className="text-sm text-muted-foreground sm:col-span-2">Vencimento: {formatDateBR(warrantyEndDate(draft.start, Number(draft.months)))}</p>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="warranty-coverage">Peças e serviços cobertos</Label><Textarea id="warranty-coverage" required value={draft.coverage} onChange={(e) => setDraft({ ...draft, coverage: e.target.value })} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="warranty-terms">Condições e observações</Label><Textarea id="warranty-terms" value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} /></div>
      <p className="text-xs text-muted-foreground sm:col-span-2">A emissão e cada alteração ficam registradas. Garantias emitidas não podem ser apagadas; correções preservam o histórico.</p>
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}><Save />{saving ? "Salvando…" : "Salvar garantia"}</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button></div>
    </form>}
  </section>;
}

function WarrantyAudit({ warrantyId }: { warrantyId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["warranty-audit", warrantyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("warranty_change_events").select("id,event_type,actor_id,occurred_at").eq("warranty_id", warrantyId).order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; event_type: string; actor_id: string | null; occurred_at: string }[];
    },
  });
  if (!data.length) return null;
  return <details className="text-sm">
    <summary className="flex cursor-pointer items-center gap-2 font-medium"><History className="size-4" />Histórico da garantia ({data.length})</summary>
    <ul className="mt-2 space-y-1 pl-6 text-muted-foreground">
      {data.map((event) => <li key={event.id}>{event.event_type === "created" ? "Garantia emitida" : "Garantia alterada"} · {new Date(event.occurred_at).toLocaleString("pt-BR")} · usuário {event.actor_id ?? "não identificado"}</li>)}
    </ul>
  </details>;
}

function WarrantyReturnPanel({ warrantyId, canManage }: { warrantyId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ReturnDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["warranty-returns", warrantyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("warranty_returns").select("id,warranty_id,service_order_id,status,complaint,diagnosis,resolution,parts_used,labor_description,received_at,updated_at,closed_at").eq("warranty_id", warrantyId).order("received_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; warranty_id: string; service_order_id: string; status: string; complaint: string; diagnosis: string; resolution: string; parts_used: string; labor_description: string; received_at: string; updated_at: string; closed_at: string | null }[];
    },
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (draft.complaint.trim().length < 5) { toast.error("Descreva o motivo do retorno."); return; }
    if (draft.status === "resolved" || draft.status === "not_covered") {
      if (draft.resolution.trim().length < 3) { toast.error("Informe a solução ou justificativa para encerrar."); return; }
      if (!draft.diagnosis.trim()) { toast.error("Registre a avaliação técnica antes de encerrar."); return; }
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("register_warranty_return", {
        _warranty_id: warrantyId,
        _complaint: draft.complaint.trim(),
        _return_id: draft.id ?? null,
        _status: draft.status,
        _diagnosis: draft.diagnosis.trim(),
        _resolution: draft.resolution.trim(),
        _parts_used: draft.parts_used.trim(),
        _labor_description: draft.labor_description.trim(),
      });
      if (error) { toast.error(error.message || "Não foi possível salvar o retorno."); return; }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["warranty-returns", warrantyId] }),
        qc.invalidateQueries({ queryKey: ["warranty-audit", warrantyId] }),
      ]);
      setDraft(null);
      toast.success("Retorno em garantia registrado e auditado.");
    } finally { setSaving(false); }
  }

  return <div className="space-y-3 border-t border-border pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold"><Wrench className="size-4" />Retornos em garantia</h3>
      {canManage && <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ complaint: "", diagnosis: "", resolution: "", parts_used: "", labor_description: "", status: "received" })}><Plus />Registrar retorno</Button>}
    </div>
    {isLoading && <p className="text-sm text-muted-foreground">Carregando retornos…</p>}
    {error && <p className="text-sm text-destructive">Não foi possível carregar os retornos. Verifique a migration e as permissões do banco.</p>}
    {!isLoading && !error && data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum retorno registrado para esta garantia.</p>}
    {data.map((item) => <ReturnHistory key={item.id} item={item} canManage={canManage} onEdit={() => setDraft({
      id: item.id, complaint: item.complaint, diagnosis: item.diagnosis, resolution: item.resolution,
      parts_used: item.parts_used, labor_description: item.labor_description, status: item.status,
    })} />)}
    {draft && <form onSubmit={save} className="grid gap-3 rounded-md bg-muted/40 p-3">
      <p className="text-sm font-semibold">{draft.id ? "Atualizar retorno" : "Novo retorno"} · OS original preservada</p>
      <div className="space-y-1"><Label htmlFor={`return-complaint-${warrantyId}`}>Reclamação / motivo do retorno</Label><Textarea id={`return-complaint-${warrantyId}`} required value={draft.complaint} onChange={(e) => setDraft({ ...draft, complaint: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`return-diagnosis-${warrantyId}`}>Avaliação / diagnóstico técnico</Label><Textarea id={`return-diagnosis-${warrantyId}`} value={draft.diagnosis} onChange={(e) => setDraft({ ...draft, diagnosis: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`return-parts-${warrantyId}`}>Peças utilizadas</Label><Textarea id={`return-parts-${warrantyId}`} value={draft.parts_used} onChange={(e) => setDraft({ ...draft, parts_used: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`return-labor-${warrantyId}`}>Serviço executado</Label><Textarea id={`return-labor-${warrantyId}`} value={draft.labor_description} onChange={(e) => setDraft({ ...draft, labor_description: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`return-status-${warrantyId}`}>Situação</Label><Select value={draft.status} onValueChange={(status) => setDraft({ ...draft, status })}><SelectTrigger id={`return-status-${warrantyId}`}><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="received" disabled={Boolean(draft.id && draft.status !== "received")}>Recebido</SelectItem>
        <SelectItem value="in_review">Em análise</SelectItem>
        <SelectItem value="resolved">Resolvido</SelectItem>
        <SelectItem value="not_covered">Fora da cobertura</SelectItem>
      </SelectContent></Select></div>
      {(draft.status === "resolved" || draft.status === "not_covered") && <div className="space-y-1"><Label htmlFor={`return-resolution-${warrantyId}`}>Solução / justificativa de encerramento</Label><Textarea id={`return-resolution-${warrantyId}`} required value={draft.resolution} onChange={(e) => setDraft({ ...draft, resolution: e.target.value })} /></div>}
      <div className="flex gap-2"><Button type="submit" disabled={saving}><Save />{saving ? "Salvando…" : "Salvar retorno"}</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button></div>
      <p className="text-xs text-muted-foreground">Após encerrado, o registro fica bloqueado. Se o veículo retornar novamente, registre um novo retorno.</p>
    </form>}
  </div>;
}

function ReturnHistory({ item, onEdit, canManage }: { canManage: boolean; item: { id: string; status: string; complaint: string; diagnosis: string; resolution: string; parts_used: string; labor_description: string; received_at: string; closed_at: string | null }; onEdit: () => void }) {
  const { data: events = [] } = useQuery({
    queryKey: ["warranty-return-events", item.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("warranty_return_events").select("id,event_type,actor_id,occurred_at").eq("warranty_return_id", item.id).order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; event_type: string; actor_id: string | null; occurred_at: string }[];
    },
  });
  const closed = item.status === "resolved" || item.status === "not_covered";
  return <article className="space-y-2 rounded-md border border-border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="font-medium">{returnLabels[item.status] ?? item.status}</p><p className="text-xs text-muted-foreground">Recebido em {new Date(item.received_at).toLocaleString("pt-BR")}{item.closed_at ? ` · Encerrado em ${new Date(item.closed_at).toLocaleString("pt-BR")}` : ""}</p></div>
      {!closed && canManage && <Button type="button" size="sm" variant="outline" onClick={onEdit}><Pencil />Atualizar</Button>}
    </div>
    <p className="text-sm"><strong>Motivo:</strong> {item.complaint}</p>
    {item.diagnosis && <p className="text-sm"><strong>Diagnóstico:</strong> {item.diagnosis}</p>}
    {item.parts_used && <p className="text-sm"><strong>Peças:</strong> {item.parts_used}</p>}
    {item.labor_description && <p className="text-sm"><strong>Serviço:</strong> {item.labor_description}</p>}
    {item.resolution && <p className="text-sm"><strong>Solução / justificativa:</strong> {item.resolution}</p>}
    <details className="text-xs">
      <summary className="flex cursor-pointer items-center gap-2 text-muted-foreground"><ClipboardList className="size-3" />Auditoria ({events.length} evento(s))</summary>
      <ul className="mt-1 space-y-1 pl-5 text-muted-foreground">{events.map((event) => <li key={event.id}>{event.event_type === "created" ? "Retorno registrado" : "Retorno atualizado"} · {new Date(event.occurred_at).toLocaleString("pt-BR")} · usuário {event.actor_id ?? "não identificado"}</li>)}</ul>
    </details>
  </article>;
}
