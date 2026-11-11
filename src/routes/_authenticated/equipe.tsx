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
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id).maybeSingle();
    if (error || !data || !["secretaria", "mecanico"].includes(data.role)) throw redirect({ to: "/painel" });
    return { staffRole: data.role as Role };
  },
  component: StaffDashboard,
});

function StaffDashboard() {
  const { user, staffRole } = Route.useRouteContext();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("Ative as notificações do navegador para acompanhar atualizações.");
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [unread, setUnread] = useState(0);

  async function load() {
    setLoading(true);
    if (staffRole === "mecanico") {
      const { data, error } = await (supabase as any).from("service_order_assignments")
        .select("id, service_order_id, assigned_at, service_orders(id, number, vehicle, plate, complaint, diagnosis, due_date, status)")
        .eq("mechanic_user_id", user.id).eq("active", true).order("assigned_at", { ascending: false });
      if (error) toast.error("Não foi possível carregar suas ordens.");
      setItems(data ?? []);
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
    const { error } = await (supabase as any).from("technical_service_logs").insert({
      service_order_id: orderId, mechanic_user_id: user.id, procedure: "Andamento do serviço",
      description, result: "Em andamento", observations: ""
    });
    if (error) { toast.error("Não foi possível salvar o andamento."); return; }
    setDrafts((old) => ({ ...old, [orderId]: "" }));
    toast.success("Andamento registrado.");
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
    <section className="space-y-3">
      <div className="flex items-center gap-2">{staffRole === "mecanico" ? <Wrench/> : <CalendarDays/>}<h2 className="text-xl font-semibold">{staffRole === "mecanico" ? "Minhas ordens de serviço" : "Agenda de atendimentos"}</h2></div>
      {loading ? <p className="rounded border p-5 text-muted-foreground">Carregando…</p> : items.length === 0 ? <p className="rounded border border-dashed p-8 text-center text-muted-foreground">{staffRole === "mecanico" ? "Nenhuma ordem atribuída no momento." : "Nenhum atendimento agendado."}</p> :
      <div className="space-y-3">{items.map((item) => {
        const order = item.service_orders;
        const id = staffRole === "mecanico" ? item.service_order_id : item.id;
        return <article key={item.id} className="space-y-3 rounded-lg border bg-card p-4">
          {staffRole === "mecanico" ? <>
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">OS nº {order?.number ?? "—"} · {order?.vehicle ?? "Veículo"}</h3><span className="text-sm text-muted-foreground">{order?.status ?? "—"}</span></div>
            <p className="text-sm">Placa: {order?.plate ?? "—"} · Prazo: {order?.due_date ?? "Não informado"}</p>
            <p className="text-sm"><strong>Reclamação:</strong> {order?.complaint ?? "—"}</p>
            {order?.diagnosis && <p className="text-sm"><strong>Diagnóstico:</strong> {order.diagnosis}</p>}
            <div className="flex flex-col gap-2 sm:flex-row"><Input value={drafts[id] ?? ""} onChange={(e) => setDrafts((old) => ({...old,[id]:e.target.value}))} placeholder="Descreva o andamento do serviço"/><Button onClick={() => void saveLog(id)}>Registrar andamento</Button></div>
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
