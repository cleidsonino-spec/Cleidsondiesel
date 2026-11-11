import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Mechanic = { mechanic_user_id: string; mechanic_name: string };
type TechnicalLog = { id: string; service_order_id: string; mechanic_user_id: string; procedure: string; description: string; result: string | null; observations: string | null; created_at: string };
type Assignment = { id: string; mechanic_user_id: string; active: boolean; assigned_at: string };

const client = () => supabase as any;
const labelProcedure = (value: string) => ({
  remocao_bomba: "Remoção da bomba", remocao_bicos: "Remoção dos bicos",
  teste_bomba: "Teste da bomba", teste_bicos: "Teste dos bicos",
  scanner: "Scanner", diagnostico_eletronico: "Diagnóstico eletrônico",
  reparo: "Reparo", montagem_instalacao: "Montagem / instalação",
  teste_final: "Teste final", outro: "Outro",
}[value] ?? value);

export function StaffOrderTools({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [mechanicId, setMechanicId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const mechanicsQuery = useQuery({
    queryKey: ["staff-mechanics"],
    queryFn: async () => {
      const { data, error } = await client().rpc("staff_mechanic_service_counts");
      if (error) throw error;
      return (data ?? []) as Mechanic[];
    },
  });
  const assignmentsQuery = useQuery({
    queryKey: ["order-assignment", orderId],
    queryFn: async () => {
      const { data, error } = await client().from("service_order_assignments")
        .select("id,mechanic_user_id,active,assigned_at")
        .eq("service_order_id", orderId).eq("active", true).maybeSingle();
      if (error) throw error;
      return data as Assignment | null;
    },
  });
  const logsQuery = useQuery({
    queryKey: ["technical-logs", orderId],
    queryFn: async () => {
      const { data, error } = await client().from("technical_service_logs")
        .select("id,service_order_id,mechanic_user_id,procedure,description,result,observations,created_at")
        .eq("service_order_id", orderId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TechnicalLog[];
    },
  });
  const verifiedQuery = useQuery({
    queryKey: ["verified-procedures", orderId],
    queryFn: async () => {
      const { data, error } = await client().from("verified_service_procedures")
        .select("id,technical_log_id,procedure,description,result,observations,created_at")
        .eq("service_order_id", orderId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; technical_log_id: string; procedure: string; description: string; result: string | null; observations: string | null; created_at: string }[];
    },
  });

  const mechanics = mechanicsQuery.data ?? [];
  const names = useMemo(() => new Map(mechanics.map((m) => [m.mechanic_user_id, m.mechanic_name])), [mechanics]);
  const verifiedIds = new Set((verifiedQuery.data ?? []).map((item) => item.technical_log_id));
  const currentName = assignmentsQuery.data ? names.get(assignmentsQuery.data.mechanic_user_id) ?? "Mecânico atribuído" : "Nenhum mecânico atribuído";

  async function assign() {
    if (!mechanicId) { toast.error("Selecione um mecânico."); return; }
    setAssigning(true);
    try {
      const { error } = await client().rpc("staff_assign_service_order", {
        _service_order_id: orderId, _mechanic_user_id: mechanicId,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["order-assignment", orderId] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("OS atribuída ao mecânico.");
      setMechanicId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atribuir a OS.");
    } finally { setAssigning(false); }
  }

  async function verify(logId: string) {
    setVerifyingId(logId);
    try {
      const { error } = await client().rpc("staff_verify_technical_log", { _technical_log_id: logId });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["verified-procedures", orderId] });
      await qc.invalidateQueries({ queryKey: ["mechanic-service-counts"] });
      toast.success("Procedimento conferido e incluído na OS oficial.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível conferir o procedimento.");
    } finally { setVerifyingId(null); }
  }

  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-4 print:hidden">
      <div><h2 className="text-lg font-semibold">Equipe e conferência técnica</h2><p className="text-sm text-muted-foreground">Atribua a OS e confira os registros enviados pelo mecânico.</p></div>
      <div className="space-y-2 rounded-md bg-muted/40 p-3">
        <p className="flex items-center gap-2 text-sm font-medium"><UserRound className="size-4" /> Responsável atual: {assignmentsQuery.isLoading ? "Carregando..." : currentName}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="Selecionar mecânico" value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3">
            <option value="">Selecionar mecânico</option>
            {mechanics.map((m) => <option key={m.mechanic_user_id} value={m.mechanic_user_id}>{m.mechanic_name}</option>)}
          </select>
          <Button type="button" onClick={() => void assign()} disabled={assigning || !mechanicId || mechanicsQuery.isLoading}>{assigning ? "Atribuindo..." : "Atribuir / transferir OS"}</Button>
        </div>
        {mechanicsQuery.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a lista de mecânicos.</p>}
      </div>
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 font-semibold"><Wrench className="size-4" /> Procedimentos registrados</h3>
        {logsQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando registros...</p>
          : logsQuery.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os registros técnicos.</p>
          : (logsQuery.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há procedimentos registrados pelo mecânico.</p>
          : (logsQuery.data ?? []).map((log) => {
            const verified = verifiedIds.has(log.id);
            return <article key={log.id} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-medium">{labelProcedure(log.procedure)}</p><p className="text-xs text-muted-foreground">{names.get(log.mechanic_user_id) ?? "Mecânico"} · {new Date(log.created_at).toLocaleString("pt-BR")}</p></div>
                {verified ? <span className="inline-flex items-center gap-1 text-sm text-success"><CheckCircle2 className="size-4" /> Conferido</span>
                  : <Button size="sm" onClick={() => void verify(log.id)} disabled={verifyingId === log.id}><ClipboardCheck className="size-4" /> {verifyingId === log.id ? "Conferindo..." : "Conferir e incluir na OS"}</Button>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{log.description}</p>
              {log.result && <p className="text-sm"><strong>Resultado:</strong> {log.result}</p>}
              {log.observations && <p className="whitespace-pre-wrap text-sm"><strong>Observações:</strong> {log.observations}</p>}
            </article>;
          })}
      </div>
      {verifiedQuery.isError && <p role="alert" className="text-sm text-destructive">Não foi possível consultar os procedimentos conferidos.</p>}
    </section>
  );
}
