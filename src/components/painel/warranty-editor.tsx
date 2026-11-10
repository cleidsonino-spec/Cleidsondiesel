import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil, Plus, Save, ShieldCheck, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { warrantiesQuery, warrantyEndDate, warrantyState } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type Draft = { id?: string; start: string; months: string; coverage: string; terms: string };

export function WarrantyEditor({ orderId, orderStatus }: { orderId: string; orderStatus: OrderStatus }) {
  const { data } = useSuspenseQuery(warrantiesQuery());
  const list = data.filter((w) => w.service_order_id === orderId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const canIssue = orderStatus === "pronto";

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    if (!draft.id && !canIssue) {
      toast.error("A garantia só pode ser emitida quando a OS estiver pronta para retirada.");
      return;
    }
    const months = Number(draft.months);
    const end = warrantyEndDate(draft.start, months);
    if (!end || !draft.coverage.trim()) {
      toast.error("Informe um prazo válido de 1 a 120 meses e os serviços cobertos.");
      return;
    }
    setSaving(true);
    try {
      const common = {
        duration_months: months,
        coverage: draft.coverage.trim(),
        terms: draft.terms.trim(),
      };
      const result = draft.id
        ? await supabase.from("warranties").update(common).eq("id", draft.id)
        : await supabase.from("warranties").insert({
            ...common,
            service_order_id: orderId,
            // O trigger do banco define a data oficial de início e recalcula o vencimento.
            start_date: todayISO(),
            end_date: end,
          });
      if (result.error) {
        console.error("Erro ao salvar garantia:", result.error);
        toast.error(result.error.message || "Não foi possível salvar a garantia.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["warranties"] });
      setDraft(null);
      toast.success(draft.id ? "Garantia atualizada." : "Garantia emitida.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta garantia?")) return;
    const { error } = await supabase.from("warranties").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir garantia:", error);
      toast.error(error.message || "Não foi possível excluir a garantia.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["warranties"] });
    toast.success("Garantia excluída.");
  }

  const startForPreview = draft?.start ?? todayISO();
  return (
    <section className="space-y-4 border-t border-border pt-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl"><ShieldCheck className="text-primary" />Garantia da OS</h2>
        <Button
          type="button"
          variant="outline"
          disabled={!canIssue || list.length > 0}
          title={!canIssue ? "A OS precisa estar pronta para retirada." : list.length > 0 ? "Esta OS já possui garantia." : undefined}
          onClick={() => setDraft({ start: todayISO(), months: "", coverage: "", terms: "" })}
        ><Plus />Emitir garantia</Button>
      </div>
      {!canIssue && list.length === 0 && (
        <p className="text-sm text-muted-foreground">A garantia será liberada quando a OS estiver em <strong>Pronto p/ retirada</strong>.</p>
      )}
      {list.length === 0 && !draft && <p className="text-sm text-muted-foreground">Nenhuma garantia emitida.</p>}
      {list.map((w) => (
        <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
          <div>
            <p className="font-semibold">{warrantyState(w.start_date, w.end_date, todayISO())} · {w.duration_months} meses</p>
            <p className="text-sm text-muted-foreground">{formatDateBR(w.start_date)} a {formatDateBR(w.end_date)}</p>
            <p className="whitespace-pre-wrap text-sm">{w.coverage || "Cobertura não informada"}</p>
          </div>
          <div className="flex gap-1">
            <Button asChild variant="outline" size="sm"><Link to="/painel/garantias/$id" params={{ id: w.id }}><Printer />Certificado</Link></Button>
            <Button type="button" variant="ghost" size="icon" title="Editar garantia" aria-label="Editar garantia" onClick={() => setDraft({ id: w.id, start: w.start_date, months: String(w.duration_months), coverage: w.coverage, terms: w.terms })}><Pencil /></Button>
            <Button type="button" variant="ghost" size="icon" title="Excluir garantia" aria-label="Excluir garantia" onClick={() => remove(w.id)}><Trash2 /></Button>
          </div>
        </div>
      ))}
      {draft && (
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="warranty-start">Início da garantia</Label>
            <Input id="warranty-start" type="date" value={draft.start} readOnly disabled />
            <p className="text-xs text-muted-foreground">{draft.id ? "A data original não pode ser alterada." : "Será registrada automaticamente na emissão."}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="warranty-months">Prazo (meses)</Label>
            <Input id="warranty-months" required type="number" min={1} max={120} step={1} value={draft.months} onChange={(e) => setDraft({ ...draft, months: e.target.value })} />
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-2">Vencimento previsto: {formatDateBR(warrantyEndDate(startForPreview, Number(draft.months)))}</p>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="warranty-coverage">Peças e serviços cobertos</Label><Textarea id="warranty-coverage" required value={draft.coverage} onChange={(e) => setDraft({ ...draft, coverage: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="warranty-terms">Condições e observações</Label><Textarea id="warranty-terms" value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} /></div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}><Save />{saving ? "Salvando…" : draft.id ? "Atualizar garantia" : "Salvar garantia"}</Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
          </div>
        </form>
      )}
    </section>
  );
}
