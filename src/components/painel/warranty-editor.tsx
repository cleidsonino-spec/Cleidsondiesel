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
import { warrantiesQuery, warrantyEndDate, warrantyState, canIssueWarranty } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";

type Draft = { id?: string; start: string; months: string; coverage: string; terms: string };
export function WarrantyEditor({ orderId, orderStatus, deliveredAt }: { orderId: string; orderStatus: string; deliveredAt: string | null }) {
  const { data } = useSuspenseQuery(warrantiesQuery());
  const list = data.filter((w) => w.service_order_id === orderId);
  const canIssue = canIssueWarranty(orderStatus, deliveredAt);
  const deliveryDate = deliveredAt
    ? (() => {
        const parts = new Intl.DateTimeFormat("en", {
          timeZone: "America/Bahia",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date(deliveredAt));
        const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? "";
        return `${part("year")}-${part("month")}-${part("day")}`;
      })()
    : "";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.id && !canIssue) {
      toast.error("A garantia só pode ser emitida após registrar a entrega do veículo.");
      return;
    }
    const start = draft.id ? draft.start : deliveryDate;
    const end = warrantyEndDate(start, Number(draft.months));
    if (!end || !draft.coverage.trim()) {
      toast.error("Informe prazo de 1 a 120 meses e serviços cobertos.");
      return;
    }
    setSaving(true);
    try {
      const input = { service_order_id: orderId, duration_months: Number(draft.months), end_date: end, coverage: draft.coverage.trim(), terms: draft.terms.trim() };
      const { error } = draft.id
        ? await supabase.from("warranties").update(input).eq("id", draft.id)
        : await supabase.from("warranties").insert({ ...input, start_date: start });
      if (error) { toast.error(`Não foi possível salvar a garantia: ${error.message}`); return; }
      await qc.invalidateQueries({ queryKey: ["warranties"] });
      setDraft(null);
      toast.success("Garantia salva.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta garantia?")) return;
    const { error } = await supabase.from("warranties").delete().eq("id", id);
    if (error) { toast.error("Não foi possível excluir a garantia."); return; }
    await qc.invalidateQueries({ queryKey: ["warranties"] });
    toast.success("Garantia excluída.");
  }

  return <section className="space-y-4 border-t border-border pt-6 print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl"><ShieldCheck className="text-primary" />Garantia da OS</h2>
      <Button type="button" variant="outline" disabled={!canIssue || list.length > 0} onClick={() => setDraft({ start: deliveryDate, months: "", coverage: "", terms: "" })}><Plus />Emitir garantia</Button>
    </div>
    {!canIssue && list.length === 0 && <p className="text-sm text-muted-foreground">{orderStatus !== "entregue" ? "A garantia será liberada somente quando o veículo for marcado como Entregue." : "A OS está entregue, mas ainda não possui uma data de entrega registrada. Não é possível iniciar a garantia sem essa data."}</p>}
    {list.length > 0 && <p className="text-sm text-muted-foreground">Esta OS já possui uma garantia emitida.</p>}
    {list.length === 0 && !draft && canIssue && <p className="text-sm text-muted-foreground">Veículo entregue em {formatDateBR(deliveryDate)}. A garantia começará nessa data.</p>}
    {list.map((w) => <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
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
    </div>)}
    {draft && <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="warranty-start">Início da garantia</Label><Input id="warranty-start" type="date" value={draft.start} disabled required /></div>
      <div className="space-y-2"><Label htmlFor="warranty-months">Prazo (meses)</Label><Input id="warranty-months" required type="number" min={1} max={120} step={1} value={draft.months} onChange={(e) => setDraft({ ...draft, months: e.target.value })} /></div>
      <p className="text-sm text-muted-foreground sm:col-span-2">Vencimento: {formatDateBR(warrantyEndDate(draft.id ? draft.start : deliveryDate, Number(draft.months)))}</p>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="warranty-coverage">Peças e serviços cobertos</Label><Textarea id="warranty-coverage" required value={draft.coverage} onChange={(e) => setDraft({ ...draft, coverage: e.target.value })} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="warranty-terms">Condições e observações</Label><Textarea id="warranty-terms" value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} /></div>
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}><Save />{saving ? "Salvando…" : "Salvar garantia"}</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button></div>
    </form>}
  </section>;
}
