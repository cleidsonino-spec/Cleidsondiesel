import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CalendarClock, CheckCircle2, ClockAlert, ShieldAlert, Wrench } from "lucide-react";

import { appointmentsQuery, ordersQuery } from "@/lib/queries";
import { warrantiesQuery } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { formatPlate } from "@/lib/plate";

function daysUntil(date: string, today: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

function useNotifications() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery(ordersQuery());
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery(appointmentsQuery());
  const { data: warranties = [], isLoading: warrantiesLoading } = useQuery(warrantiesQuery());
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
      icon: "order" | "ready" | "warranty" | "appointment";
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

    const rank = { urgent: 0, warning: 1, info: 2 };
    return items.sort((a, b) => rank[a.priority] - rank[b.priority] || a.date.localeCompare(b.date));
  }, [orders, appointments, warranties, today]);

  return { notifications, isLoading: ordersLoading || appointmentsLoading || warrantiesLoading };
}

export function NotificationBell() {
  const { notifications } = useNotifications();
  return (
    <Link to="/painel/" hash="notificacoes" aria-label={`Notificações: ${notifications.length} alerta(s)`} className="relative flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
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
            const Icon = item.icon === "warranty" ? ShieldAlert : item.icon === "appointment" ? CalendarClock : item.icon === "ready" ? CheckCircle2 : item.priority === "urgent" ? ClockAlert : Wrench;
            const href = item.href === "/painel/ordens/$id" ? `/painel/ordens/${item.params?.id}` : item.href === "/painel/garantias/$id" ? `/painel/garantias/${item.params?.id}` : item.href;
            return (
              <a key={item.id} href={href} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-secondary/60">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${item.priority === "urgent" ? "bg-destructive/10 text-destructive" : item.priority === "warning" ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"}`}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{item.title}</span><span className="block truncate text-sm text-muted-foreground">{item.detail}</span></span>
                <span className="text-xs text-muted-foreground">{formatDateBR(item.date)}</span>
              </a>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Os alertas são calculados automaticamente a partir das OS, garantias e agendamentos existentes. Não há marcação manual de leitura nem alteração dos registros.</p>
    </section>
  );
}
