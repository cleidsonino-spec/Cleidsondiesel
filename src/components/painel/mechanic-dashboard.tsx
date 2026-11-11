import { useState, type FormEvent } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardList, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ordersQuery } from "@/lib/queries";
import { formatPlate } from "@/lib/plate";
import { formatDateBR } from "@/lib/schedule";
import { orderStatusInfo } from "@/lib/status";
import { StatusBadge } from "@/components/site/status-badge";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];
type Procedure = "remocao_bomba" | "remocao_bicos" | "teste_bomba" | "teste_bicos" | "scanner" | "diagnostico_eletronico" | "reparo" | "montagem_instalacao" | "teste_final" | "outro";

const procedures: { value: Procedure; label: string }[] = [
  { value: "remocao_bomba", label: "Remoção da bomba" },
  { value: "remocao_bicos", label: "Remoção dos bicos" },
  { value: "teste_bomba", label: "Teste da bomba" },
  { value: "teste_bicos", label: "Teste dos bicos" },
  { value: "scanner", label: "Scanner" },
  { value: "diagnostico_eletronico", label: "Diagnóstico eletrônico" },
  { value: "reparo", label: "Reparo" },
  { value: "montagem_instalacao", label: "Montagem / instalação" },
  { value: "teste_final", label: "Teste final" },
  { value: "outro", label: "Outro" },
];

export function MechanicDashboard() {
  const { data: orders } = useSuspenseQuery(ordersQuery());
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Order | null>(null);
  const [procedure, setProcedure] = useState<Procedure>("teste_bomba");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected || !description.trim()) {
      toast.error("Descreva o procedimento realizado.");
      return;
    }
    setSaving(true);
    try {
      const client = supabase as any;
      const { error } = await client.rpc("mechanic_add_technical_log", {
        _service_order_id: selected.id,
        _procedure: procedure,
        _description: description.trim(),
        _result: result.trim() || null,
        _observations: observations.trim() || null,
      });
      if (error) throw error;
      toast.success("Procedimento registrado para conferência.");
      setSelected(null);
      setDescription("");
      setResult("");
      setObservations("");
      await qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o procedimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Área técnica</p>
        <h1 className="text-3xl">Painel do mecânico</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aqui aparecem somente as ordens de serviço atribuídas a você. Registre cada procedimento realizado para a secretaria ou administração conferir.</p>
      </div>
      <section className="space-y-3">
        <div className="flex items-center gap-2"><ClipboardList className="size-5" /><h2 className="text-xl font-semibold">Minhas ordens de serviço ({orders.length})</h2></div>
        {orders.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma OS ativa foi atribuída a você.</div>
        ) : orders.map((order) => {
          const status = orderStatusInfo(order.status);
          return (
            <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="font-semibold">OS nº {order.number} · {order.customer_name}</p>
                <p className="text-sm text-muted-foreground">{formatPlate(order.plate)} · {order.vehicle}</p>
                <p className="mt-1 text-sm">{order.complaint}</p>
                <p className="mt-1 text-xs text-muted-foreground">Entrada: {formatDateBR(order.entry_date)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={status.tone} label={status.label} />
                <Button asChild size="sm" variant="outline"><Link to="/painel/ordens/$id" params={{ id: order.id }}>Ver OS</Link></Button>
                <Button size="sm" onClick={() => setSelected(order)}><Wrench /> Registrar procedimento</Button>
              </div>
            </article>
          );
        })}
      </section>

      {selected && (
        <section className="rounded-md border border-primary/40 bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-semibold">Registro técnico · OS nº {selected.number}</h2><p className="text-sm text-muted-foreground">{selected.customer_name} · {formatPlate(selected.plate)}</p></div>
            <Button type="button" variant="ghost" onClick={() => setSelected(null)}>Fechar</Button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <label className="block space-y-1 text-sm"><span className="font-medium">Procedimento</span><select value={procedure} onChange={(e) => setProcedure(e.target.value as Procedure)} className="h-10 w-full rounded-md border border-input bg-background px-3">{procedures.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
            <label className="block space-y-1 text-sm"><span className="font-medium">O que foi realizado *</span><Textarea value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={4000} rows={3} placeholder="Descreva o serviço e as etapas realizadas." /></label>
            <label className="block space-y-1 text-sm"><span className="font-medium">Resultado</span><Textarea value={result} onChange={(e) => setResult(e.target.value)} maxLength={2000} rows={2} placeholder="Informe o resultado dos testes ou do procedimento." /></label>
            <label className="block space-y-1 text-sm"><span className="font-medium">Observações</span><Textarea value={observations} onChange={(e) => setObservations(e.target.value)} maxLength={4000} rows={2} placeholder="Medições, peças, anormalidades ou recomendações." /></label>
            <Button type="submit" disabled={saving || !description.trim()}>{saving ? "Salvando..." : "Enviar para conferência"}</Button>
          </form>
        </section>
      )}
      <p className="text-xs text-muted-foreground">Os registros enviados não alteram a OS oficial. A secretaria ou o administrador fará a conferência e inclusão no documento oficial.</p>
    </div>
  );
}
