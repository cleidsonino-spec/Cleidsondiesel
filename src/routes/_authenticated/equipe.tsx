import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, ClipboardList, LogOut, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = "secretaria" | "mecanico";

export const Route = createFileRoute("/_authenticated/equipe")({
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if (error) throw error;
    const roles = (data ?? []).map((item) => item.role);
    const staffRole = roles.includes("mecanico") ? "mecanico" : roles.includes("secretaria") ? "secretaria" : null;
    if (!staffRole) throw redirect({ to: "/painel" });
    return { staffRole: staffRole as Role };
  },
  component: StaffDashboard,
});

function YesNoQuestion({ title, value, onChange }: { title: string; value: boolean | null; onChange: (value: boolean) => void }) { return <fieldset className="space-y-2"><legend className="text-sm font-medium">{title}</legend><div className="flex gap-2"><Button type="button" size="sm" variant={value === true ? "default" : "outline"} aria-pressed={value === true} onClick={() => onChange(true)}>Sim</Button><Button type="button" size="sm" variant={value === false ? "default" : "outline"} aria-pressed={value === false} onClick={() => onChange(false)}>Não</Button></div></fieldset>; }

function StaffDashboard() {
  const { user, staffRole } = Route.useRouteContext();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("Ative as notificações do navegador para acompanhar atualizações.");
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [diagnoses, setDiagnoses] = useState<Record<string,string>>({});
  const [maintenanceChecks, setMaintenanceChecks] = useState<Record<string, { fuelFilter: boolean | null; systemCleaning: boolean | null }>>({});
  const [unread, setUnread] = useState(0);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [warrantyContexts, setWarrantyContexts] = useState<Record<string, any>>({});

  async function load() {
    setLoading(true);
    if (staffRole === "mecanico") {
      const { data, error } = await (supabase as any).from("service_order_assignments")
        .select("id, service_order_id, assigned_at, service_orders(id, number, customer_name, vehicle, plate, complaint, diagnosis, due_date, status, fuel_filter_replacement, system_cleaning)")
        .eq("mechanic_user_id", user.id).eq("active", true).order("assigned_at", { ascending: false });
      if (error) toast.error("Não foi possível carregar suas ordens.");
      const orderIds = (data ?? []).map((row: any) => row.service_order_id);
      const contexts = await Promise.all(orderIds.map(async (orderId: string) => {
        const { data: contextRows, error: contextError } = await (supabase as any).rpc("get_warranty_return_context", { _return_order_id: orderId });
        if (contextError) return [orderId, null];
        return [orderId, contextRows?.[0] ?? null];
      }));
      const contextMap = Object.fromEntries(contexts.filter(([, value]) => value));
      setWarrantyContexts(contextMap);
      setItems([...(data ?? [])].sort((a: any, b: any) => {
        const aPriority = contextMap[a.service_order_id] ? 1 : 0;
        const bPriority = contextMap[b.service_order_id] ? 1 : 0;
        return bPriority - aPriority || new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
      }));
      const logOrderIds = [...new Set([...orderIds, ...Object.values(contextMap).map((context: any) => context.original_order_id)])];
      if (logOrderIds.length) {
        const { data: logs, error: logsError } = await (supabase as any).from("technical_service_logs").select("id, service_order_id, procedure, description, result, observations, created_at").in("service_order_id", logOrderIds).order("created_at", { ascending: false });
        if (logsError) {
          toast.error("As ordens foram carregadas, mas não foi possível consultar o histórico técnico. Atualize a tela ou confira as permissões.");
          setHistory({});
        } else {
          const grouped: Record<string, any[]> = {};
          for (const log of logs ?? []) (grouped[log.service_order_id] ??= []).push(log);
          setHistory(grouped);
        }
      } else setHistory({});
    } else {
      const { data, error } = await supabase.from("appointments").select("*")
        .neq("status", "cancelado").order("scheduled_date", { ascending: true }).limit(100);
      if (error) toast.error("Não foi possível carregar a agenda.");
      setItems(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase.channel("staff-live-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: staffRole === "mecanico" ? "service_order_assignments" : "appointments" }, () => {
        setUnread((n) => n + 1);
        setNotice("Você tem uma atualização nova.");
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Cleidson Diesel", { body: staffRole === "mecanico" ? "Sua lista de ordens foi atualizada." : "A agenda de atendimentos foi atualizada." });
        }
        void load();
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user.id, staffRole]);

  async function enableNotifications() {
    if (!("Notification" in window)) { setNotice("Este navegador não oferece notificações."); return; }
    const permission = await Notification.requestPermission();
    setNotice(permission === "granted" ? "Notificações do navegador ativadas enquanto o app estiver aberto." : "Permissão de notificação não concedida.");
    if (permission === "granted") new Notification("Cleidson Diesel", { body: "Notificações ativadas." });
  }

  async function saveLog(orderId: string) {
    const description = drafts[orderId]?.trim();
    if (!description) { toast.error("Digite o andamento do serviço."); return; }
    const { error } = await (supabase as any).rpc("mechanic_record_service_progress", {
      _order_id: orderId, _description: description,
    });
    if (error) { toast.error(error.message || "Não foi possível salvar o andamento."); return; }
    setDrafts((old) => ({ ...old, [orderId]: "" }));
    toast.success("Andamento registrado.");
    await load();
  }

  async function startDiagnosis(orderId: string) { const { error } = await (supabase as any).rpc("mechanic_start_diagnosis", { _order_id: orderId }); if (error) { toast.error(error.message || "Não foi possível iniciar o diagnóstico."); return; } toast.success("Diagnóstico iniciado."); await load(); }

  async function completeDiagnosis(orderId: string) { const diagnosis = diagnoses[orderId]?.trim(); const checks = maintenanceChecks[orderId]; if (!diagnosis) { toast.error("Registre o diagnóstico antes de concluir."); return; } if (!checks || checks.fuelFilter === null || checks.fuelFilter === undefined || checks.systemCleaning === null || checks.systemCleaning === undefined) { toast.error("Responda às duas verificações de manutenção."); return; } const { error } = await (supabase as any).rpc("mechanic_complete_diagnosis", { _order_id: orderId, _diagnosis: diagnosis, _fuel_filter_replacement: checks.fuelFilter, _system_cleaning: checks.systemCleaning }); if (error) { toast.error(error.message || "Não foi possível concluir o diagnóstico."); return; } setDiagnoses((old) => ({ ...old, [orderId]: "" })); toast.success("Diagnóstico concluído e enviado para orçamento."); await load(); }

  async function changeStatus(orderId: string, status: "pronto") {
    const { error } = await (supabase as any).rpc("mechanic_update_order_status", { _order_id: orderId, _status: status });
    if (error) { toast.error(error.message || "Não foi possível atualizar o status."); return; }
    toast.success("Status da ordem atualizado.");
    await load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div><p className="text-sm text-muted-foreground">Cleidson Diesel · Área da equipe</p>
        <h1 className="text-2xl font-bold">{staffRole === "mecanico" ? "Painel do mecânico" : "Painel da secretaria"}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p></div>
      <Button variant="outline" onClick={signOut}><LogOut className="mr-2 size-4"/>Sair</Button>
    </header>
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3"><Bell className="size-5 text-primary"/><div><p className="font-medium">Notificações {unread > 0 ? `(${unread} novas)` : ""}</p><p className="text-sm text-muted-foreground">{notice}</p></div></div>
      <Button variant="outline" onClick={enableNotifications}>Ativar notificações</Button>
    </section>
    <div className="rounded-lg border bg-card p-4"><a href="/agenda-equipe" className="flex items-center gap-2 font-medium text-primary hover:underline"><CalendarDays className="size-5"/>Abrir agenda da equipe</a><p className="mt-1 text-sm text-muted-foreground">Consulte horários agendados e o histórico de atendimentos.</p></div>
    <section className="space-y-3">
      <div className="flex items-center gap-2">{staffRole === "mecanico" ? <Wrench/> : <CalendarDays/>}<h2 className="text-xl font-semibold">{staffRole === "mecanico" ? "Minhas ordens de serviço" : "Agenda de atendimentos"}</h2></div>
      {loading ? <p className="rounded border p-5 text-muted-foreground">Carregando…</p> : items.length === 0 ? <p className="rounded border border-dashed p-8 text-center text-muted-foreground">{staffRole === "mecanico" ? "Nenhuma ordem atribuída no momento." : "Nenhum atendimento agendado."}</p> :
      <div className="space-y-3">{items.map((item) => {
        const order = item.service_orders;
        const id = staffRole === "mecanico" ? item.service_order_id : item.id;
        return <article key={item.id} className="space-y-3 rounded-lg border bg-card p-4">
          {staffRole === "mecanico" ? <>
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">OS nº {order?.number ?? "—"} · {order?.vehicle ?? "Veículo"}</h3><span className="text-sm font-medium text-primary">{({ recebido: "Aguardando diagnóstico", em_analise: "Em diagnóstico", aguardando_aprovacao: "Aguardando orçamento/aprovação", em_servico: "Em serviço", pronto: "Serviço concluído", entregue: "Entregue", cancelado: "Cancelado" } as Record<string,string>)[order?.status] ?? order?.status ?? "—"}</span></div>
            {warrantyContexts[id] && <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3"><p className="font-bold text-amber-700">RETORNO EM GARANTIA · PRIORIDADE</p><p className="mt-1 text-sm">OS original nº {warrantyContexts[id].original_order_number}</p><p className="mt-2 text-sm"><strong>Reclamação original:</strong> {warrantyContexts[id].original_complaint || "—"}</p>{warrantyContexts[id].original_diagnosis && <p className="mt-1 text-sm"><strong>Diagnóstico original:</strong> {warrantyContexts[id].original_diagnosis}</p>}{warrantyContexts[id].original_parts && <p className="mt-1 text-sm"><strong>Peças/serviços anteriores:</strong> {warrantyContexts[id].original_parts}</p><p className="mt-2 text-sm"><strong>Motivo deste retorno:</strong> {warrantyContexts[id].return_complaint}</p>{warrantyContexts[id].return_diagnosis && <p className="mt-1 text-sm"><strong>Avaliação do retorno:</strong> {warrantyContexts[id].return_diagnosis}</p>}<div className="mt-2 border-t border-amber-500/20 pt-2"><p className="text-sm font-semibold">Histórico técnico da OS original</p>{(history[warrantyContexts[id].original_order_id] ?? []).length ? (history[warrantyContexts[id].original_order_id] ?? []).map((log: any) => <div key={log.id} className="mt-2 rounded bg-background/70 p-2 text-sm"><p className="font-medium">{log.procedure} · {log.result}</p><p>{log.description}</p>{log.observations && <p>{log.observations}</p>}<p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</p></div>) : <p className="mt-1 text-xs">Não há registros técnicos adicionais na OS original.</p>}</div></div>}
            <p className="text-sm">Placa: {order?.plate ?? "—"} · Prazo: {order?.due_date ?? "Não informado"}</p>
            <p className="text-sm"><strong>Cliente:</strong> {order?.customer_name ?? "—"}</p>
            <p className="text-sm"><strong>Reclamação:</strong> {order?.complaint ?? "—"}</p>
            {order?.diagnosis && <p className="text-sm"><strong>Diagnóstico:</strong> {order.diagnosis}</p>}
            <>{order?.status === "recebido" && <Button onClick={() => void startDiagnosis(id)}>Iniciar diagnóstico</Button>}{order?.status === "em_analise" && <div className="space-y-2"><label className="text-sm font-medium" htmlFor={"diagnosis-" + id}>Resultado do diagnóstico</label><textarea id={"diagnosis-" + id} value={diagnoses[id] ?? order?.diagnosis ?? ""} onChange={(e) => setDiagnoses((old) => ({ ...old, [id]: e.target.value }))} placeholder="Descreva os testes realizados, defeitos encontrados e reparos recomendados" className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><div className="grid gap-3 rounded-md border-2 border-primary/30 bg-muted/30 p-4 sm:grid-cols-2"><fieldset className="space-y-2"><legend className="text-sm font-semibold">Necessita trocar os filtros de combustível?</legend><div className="flex gap-4">{[true, false].map((value) => <label key={String(value)} className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm"><input type="radio" name={"fuel-filter-" + id} checked={maintenanceChecks[id]?.fuelFilter === value} onChange={() => setMaintenanceChecks((old) => ({ ...old, [id]: { fuelFilter: value, systemCleaning: old[id]?.systemCleaning ?? null } }))} />{value ? "Sim" : "Não"}</label>)}</div></fieldset><fieldset className="space-y-2"><legend className="text-sm font-semibold">Necessita limpeza do sistema?</legend><div className="flex gap-4">{[true, false].map((value) => <label key={String(value)} className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm"><input type="radio" name={"system-cleaning-" + id} checked={maintenanceChecks[id]?.systemCleaning === value} onChange={() => setMaintenanceChecks((old) => ({ ...old, [id]: { fuelFilter: old[id]?.fuelFilter ?? null, systemCleaning: value } }))} />{value ? "Sim" : "Não"}</label>)}</div></fieldset></div><p className="text-xs text-muted-foreground">As respostas serão enviadas junto com o diagnóstico para a secretaria preparar o orçamento.</p><Button onClick={() => void completeDiagnosis(id)}>Concluir diagnóstico e enviar para orçamento</Button></div>}{order?.status === "aguardando_aprovacao" && <p className="rounded-md bg-muted p-3 text-sm">Diagnóstico concluído. Aguardando orçamento e aprovação do cliente.</p>}{order?.status === "em_servico" && <div className="space-y-2"><div className="flex flex-col gap-2 sm:flex-row"><Input value={drafts[id] ?? ""} onChange={(e) => setDrafts((old) => ({...old,[id]:e.target.value}))} placeholder="Descreva o andamento do serviço"/><Button onClick={() => void saveLog(id)}>Registrar andamento</Button></div><Button variant="outline" onClick={() => void changeStatus(id, "pronto")}>Concluir serviço</Button></div>}</>
            <div className="space-y-2 border-t pt-3"><h4 className="text-sm font-semibold">Histórico do serviço</h4>{(history[id] ?? []).length ? (history[id] ?? []).map((log: any) => <div key={log.id} className="rounded bg-muted/50 p-3 text-sm"><p className="font-medium">{log.procedure} · {log.result}</p><p>{log.description}</p>{log.observations && <p className="text-muted-foreground">{log.observations}</p>}<p className="mt-1 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</p></div>) : <p className="text-xs text-muted-foreground">Nenhum andamento registrado ainda.</p>}</div>
          </> : <>
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{item.customer_name} · {item.vehicle}</h3><span className="text-sm text-muted-foreground">{item.status}</span></div>
            <p className="text-sm">{item.scheduled_date} às {String(item.scheduled_time).slice(0,5)} · {item.plate}</p>
            <p className="text-sm">{item.service_type} · {item.phone}</p>
          </>}
        </article>;
      })}</div>}
    </section>
    <p className="text-xs text-muted-foreground"><ClipboardList className="mr-1 inline size-3"/> Acesso limitado ao perfil da equipe. O mecânico vê somente ordens atribuídas à sua conta.</p>
  </main>;
}
