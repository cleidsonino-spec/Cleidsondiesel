import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AgendaRow = {
  appointment_id: string; scheduled_date: string; scheduled_time: string;
  customer_name: string; phone: string | null; plate: string; vehicle: string;
  service_type: string; notes: string | null; appointment_status: string;
  order_number: number | null; order_status: string | null; mechanic_name: string | null;
};

export const Route = createFileRoute("/_authenticated/agenda-equipe")({
  beforeLoad: async ({ context }) => {
    const { data, error } = await (supabase as any).from("user_roles").select("role,is_active").eq("user_id", context.user.id);
    if (error) throw error;
    const rows = data ?? [];
    const roles = rows.filter((item: any) => item.is_active !== false).map((item: any) => item.role);
    const hasInactiveStaffRole = rows.some((item: any) => item.is_active === false && ["mecanico", "secretaria"].includes(item.role));
    const hasActiveStaffRole = rows.some((item: any) => item.is_active !== false && ["admin", "secretaria", "mecanico"].includes(item.role));
    if (hasInactiveStaffRole && !hasActiveStaffRole) {
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth" });
    }
    if (!roles.some((role: string) => ["admin", "secretaria", "mecanico"].includes(role))) throw redirect({ to: "/equipe" });
  },
  component: TeamAgendaPage,
});

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
}

function TeamAgendaPage() {
  const [rows, setRows] = useState<AgendaRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAgenda() {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_staff_appointment_agenda");
    if (error) { toast.error("Não foi possível carregar a agenda da equipe."); setRows([]); }
    else setRows((data ?? []) as AgendaRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadAgenda();
    const channel = supabase.channel("team-agenda-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => void loadAgenda())
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => void loadAgenda())
      .on("postgres_changes", { event: "*", schema: "public", table: "service_order_assignments" }, () => void loadAgenda())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { upcoming, history } = useMemo(() => ({
    upcoming: rows.filter((row) => row.scheduled_date >= todayKey).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.scheduled_time.localeCompare(b.scheduled_time)),
    history: rows.filter((row) => row.scheduled_date < todayKey).sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date) || b.scheduled_time.localeCompare(a.scheduled_time)),
  }), [rows, todayKey]);

  function renderAppointment(row: AgendaRow) {
    const completed = row.order_status === "pronto" || row.order_status === "entregue";
    return <article key={row.appointment_id} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[130px_1fr_auto] sm:items-center">
      <div><p className="flex items-center gap-2 font-semibold text-primary"><Clock3 className="size-4"/>{String(row.scheduled_time).slice(0, 5)}</p><p className="text-xs capitalize text-muted-foreground">{formatDate(row.scheduled_date)}</p></div>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{row.customer_name} · {row.vehicle || "Veículo não informado"}</p>
        <p className="text-sm text-muted-foreground">Placa: {row.plate || "—"} · {row.service_type || "Serviço não informado"}</p>
        {row.order_number && <p className="text-xs text-muted-foreground">OS nº {row.order_number} · {row.order_status || "Sem status"}</p>}
        {row.notes && <p className="text-xs text-muted-foreground">{row.notes}</p>}
        {completed && <p className="flex items-center gap-1 text-sm font-medium"><Wrench className="size-4"/>Mecânico: {row.mechanic_name || "Não identificado no registro"}</p>}
      </div>
      <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs capitalize">{row.order_status || row.appointment_status}</span>
    </article>;
  }

  return <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div><p className="text-sm text-muted-foreground">Cleidson Diesel · Área da equipe</p><h1 className="text-2xl font-bold">Agenda da equipe</h1><p className="text-sm text-muted-foreground">Consulta de horários e histórico de atendimentos. Somente visualização.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void loadAgenda()} disabled={loading}><RefreshCw className="mr-2 size-4"/>Atualizar</Button><Button asChild variant="outline"><Link to="/equipe"><ArrowLeft className="mr-2 size-4"/>Voltar ao painel</Link></Button></div>
    </header>
    {loading ? <p className="rounded-lg border p-6 text-muted-foreground">Carregando agenda…</p> : <>
      <section className="space-y-3"><div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary"/><h2 className="text-xl font-semibold">Próximos atendimentos</h2><span className="text-sm text-muted-foreground">({upcoming.length})</span></div>{upcoming.length ? <div className="space-y-3">{upcoming.map(renderAppointment)}</div> : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Não há atendimentos futuros agendados.</p>}</section>
      <section className="space-y-3 border-t pt-5"><div className="flex items-center gap-2"><Clock3 className="size-5 text-muted-foreground"/><h2 className="text-xl font-semibold">Histórico de agendamentos</h2><span className="text-sm text-muted-foreground">({history.length})</span></div>{history.length ? <div className="space-y-3">{history.map(renderAppointment)}</div> : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Ainda não há atendimentos anteriores.</p>}</section>
    </>}
    <p className="text-xs text-muted-foreground">Esta agenda não permite criar, alterar ou cancelar agendamentos.</p>
  </main>;
}
