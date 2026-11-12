import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CalendarClock, CheckCircle2, ClockAlert, ShieldAlert, Wrench, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { appointmentsQuery, ordersQuery } from "@/lib/queries";
import { warrantiesQuery } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { formatPlate } from "@/lib/plate";

function daysUntil(date: string, today: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round((Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) - Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1)) / 86400000);
}

function useNotifications() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery(ordersQuery());
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery(appointmentsQuery());
  const { data: warranties = [], isLoading: warrantiesLoading } = useQuery(warrantiesQuery());
  const { data: quoteEvents = [], isLoading: quotesLoading } = useQuery({
    queryKey: ["quote-approvals", "decided-recent"],
    refetchInterval: 15000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await supabase.from("quote_approvals")
        .select("id,state,approved_at,rejected_at,order_id,service_orders(number,customer_name,plate,vehicle)")
        .in("state", ["approved", "rejected"])
        .or(`approved_at.gte.${since},rejected_at.gte.${since}`)
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const today = todayISO();

  const notifications = useMemo(() => {
    const items: {
      id: string;
      title: string;
      detail: string;
      date: string;
      priority: "urgent" | "warning" | "info";
      href: "/painel/ordens/$id" | "/painel/garantias/$id" | "/painel/agendamentos";
      params?: { id: string };
      icon: "order" | "ready" | "warranty" | "appointment" | "quote_approved" | "quote_rejected";
    }[] = [];

    for (const order of orders) {
      const orderHref = { href: "/painel/ordens/$id" as const, params: { id: order.id } };
      if (order.status === "aguardando_aprovacao") {
        items.push({ id: `approval-${order.id}`, title: `OS nº ${order.number} aguardando autorização`, detail: `${order.customer_name} · ${formatPlate(order.plate)}`, date: order.updated_at.slice(0, 10), priority: "urgent", ...orderHref, icon: "order" });
      }
      if (order.status === "pronto") {
        items.push({ id: `ready-${order.id}`, title: `OS nº ${order.number} pronta para retirada`, detail: `${order.customer_name} · ${formatPlate(order.plate)}`, date: order.updated_at.slice(0, 10), priority: "info", ...orderHref, icon: "ready" });
      }
      if (order.due_date && order.due_date < today && !["pronto", "entregue", "cancelado"].includes(order.status)) {
        items.push({ id: `late-${order.id}`, title: `OS nº ${order.number} com prazo vencido`, detail: `${order.customer_name} · prazo ${formatDateBR(order.due_date)}`, date: order.due_date, priority: "urgent", ...orderHref, icon: "order" });
      }
    }

    for (const warranty of warranties) {
      const remaining = daysUntil(warranty.end_date, today);
      if (remaining >= 0 && remaining <= 30) {
        items.push({
          id: `warranty-${warranty.id}`,
          title: remaining === 0 ? "Garantia vence hoje" : `Garantia vence em ${remaining} dia(s)`,
          detail: `OS nº ${warranty.service_orders?.number ?? "—"} · ${warranty.service_orders?.customer_name ?? "Cliente"} · ${formatPlate(warranty.service_orders?.plate ?? "")}`,
          date: warranty.end_date,
          priority: remaining <= 7 ? "urgent" : "warning",
          href: "/painel/garantias/$id",
          params: { id: warranty.id },
          icon: "warranty",
        });
      }
    }

    for (const appointment of appointments) {
      const remaining = daysUntil(appointment.scheduled_date, today);
      if (remaining >= 0 && remaining <= 2 && ["pendente", "confirmado"].includes(appointment.status)) {
        items.push({
          id: `appointment-${appointment.id}`,
          title: remaining === 0 ? `Agendamento hoje às ${appointment.scheduled_time.slice(0, 5)}` : `Agendamento em ${remaining} dia(s)`,
          detail: `${appointment.customer_name} · ${formatPlate(appointment.plate)} · ${appointment.vehicle}`,
          date: appointment.scheduled_date,
          priority: appointment.status === "pendente" ? "warning" : "info",
          href: "/painel/agendamentos",
          icon: "appointment",
        });
      }
    }

    for (const q of quoteEvents) {
      const o = q.service_orders;
      const approved = q.state === "approved";
      const at = (approved ? q.approved_at : q.rejected_at) ?? today;
      items.push({
        id: `quote-${q.id}-${q.state}`,
        title: `${approved ? "Orçamento aprovado" : "Orçamento recusado"} pelo cliente · OS nº ${o?.number ?? "—"}`,
        detail: `${o?.vehicle ?? "Veículo"} · ${formatPlate(o?.plate ?? "")} · ${o?.customer_name ?? "Cliente"}`,
        date: at.slice(0, 10),
        priority: approved ? "info" : "warning",
        href: "/painel/ordens/$id",
        params: { id: q.order_id },
        icon: approved ? "quote_approved" : "quote_rejected",
      });
    }

    const rank = { urgent: 0, warning: 1, info: 2 };
    return items.sort((a, b) => rank[a.priority] - rank[b.priority] || a.date.localeCompare(b.date));
  }, [orders, appointments, warranties, quoteEvents, today]);

  return { notifications, isLoading: ordersLoading || appointmentsLoading || warrantiesLoading || quotesLoading };
}

export function NotificationBell() {
  const { notifications } = useNotifications();
  return (
    <Link to="/painel" hash="notificacoes" aria-label={`Notificações: ${notifications.length} alerta(s)`} className="relative flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
      <Bell className="size-4" />
      <span className="hidden sm:inline">Notificações</span>
      {notifications.length > 0 && <span className="min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-destructive-foreground">{notifications.length > 99 ? "99+" : notifications.length}</span>}
    </Link>
  );
}

export function NotificationCenter() {
  const { notifications, isLoading } = useNotifications();
  const counts = {
    urgent: notifications.filter((item) => item.priority === "urgent").length,
    warning: notifications.filter((item) => item.priority === "warning").length,
    info: notifications.filter((item) => item.priority === "info").length,
  };

  return (
    <section id="notificacoes" className="scroll-mt-28 space-y-4" aria-labelledby="notifications-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Acompanhamento automático</p>
          <h2 id="notifications-heading" className="flex items-center gap-2 text-xl font-semibold"><Bell className="size-5 text-primary" /> Central de notificações</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">{counts.urgent} urgentes</span>
          <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">{counts.warning} atenção</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">{counts.info} informativas</span>
        </div>
      </div>

      {isLoading ? <p className="rounded-md border border-border p-5 text-sm text-muted-foreground">Carregando notificações…</p> : notifications.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
          <p className="mt-2 font-medium">Tudo em dia!</p>
          <p className="text-sm text-muted-foreground">Não há alertas operacionais neste momento.</p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
          {notifications.map((item) => {
            const Icon = item.icon === "quote_approved" ? CheckCircle2 : item.icon === "quote_rejected" ? XCircle : item.icon === "warranty" ? ShieldAlert : item.icon === "appointment" ? CalendarClock : item.icon === "ready" ? CheckCircle2 : item.priority === "urgent" ? ClockAlert : Wrench;
            const href = item.href === "/painel/ordens/$id" ? `/painel/ordens/${item.params?.id}` : item.href === "/painel/garantias/$id" ? `/painel/garantias/${item.params?.id}` : item.href;
            return (
              <a key={item.id} href={href} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-secondary/60">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${item.icon === "quote_approved" ? "bg-success/10 text-success" : item.icon === "quote_rejected" ? "bg-destructive/10 text-destructive" : item.priority === "urgent" ? "bg-destructive/10 text-destructive" : item.priority === "warning" ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"}`}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{item.title}</span><span className="block truncate text-sm text-muted-foreground">{item.detail}</span></span>
                <span className="text-xs text-muted-foreground">{formatDateBR(item.date)}</span>
              </a>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Os alertas são calculados automaticamente a partir das OS, orçamentos respondidos (últimos 7 dias), garantias e agendamentos existentes. Não há marcação manual de leitura nem alteração dos registros.</p>
    </section>
  );
}
