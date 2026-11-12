import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, ArrowDownRight, ArrowUpRight, ClipboardCheck, Coins, Package, ReceiptText, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/status";
import { formatDateBR, todayISO } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/painel/indicadores")({
  head: () => ({ meta: [
    { title: "Indicadores e lucratividade — Cleidson Diesel" },
    { name: "description", content: "Indicadores financeiros, operacionais e custos vinculados às ordens de serviço." },
    { name: "robots", content: "noindex" },
  ] }),
  component: IndicatorsPage,
});

type Order = { id: string; number: number; customer_name: string; vehicle: string; plate: string; status: string; entry_date: string; parts_value: number | string | null; labor_value: number | string | null };
type Payment = { id: string; service_order_id: string; amount: number | string; paid_at: string };
type Expense = { id: string; description: string; category: string; amount: number | string; expense_date: string };
type Completion = { service_order_id: string; completed_at: string };
type Movement = { id: string; item_id: string; service_order_id: string | null; movement_type: string; quantity: number | string; unit_cost: number | string | null; created_at: string };

function dateLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateLocal(date);
}
async function allRows<T>(table: string, columns: string, orderColumn: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await (supabase as any).from(table).select(columns).order(orderColumn, { ascending: false }).range(offset, offset + 499);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return <article className="rounded-md border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</article>;
}

function IndicatorsPage() {
  const { isAdmin } = Route.useRouteContext();
  const today = todayISO();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const report = useQuery({
    queryKey: ["management-indicators"],
    enabled: isAdmin,
    queryFn: async () => {
      const [orders, payments, expenses, completions, movements] = await Promise.all([
        allRows<Order>("service_orders", "id,number,customer_name,vehicle,plate,status,entry_date,parts_value,labor_value", "entry_date"),
        allRows<Payment>("service_order_payments", "id,service_order_id,amount,paid_at", "paid_at"),
        allRows<Expense>("shop_expenses", "id,description,category,amount,expense_date", "expense_date"),
        allRows<Completion>("service_order_completions", "service_order_id,completed_at", "completed_at"),
        allRows<Movement>("inventory_movements", "id,item_id,service_order_id,movement_type,quantity,unit_cost,created_at", "created_at"),
      ]);
      return { orders, payments, expenses, completions, movements };
    },
    staleTime: 30_000,
  });

  const summary = useMemo(() => {
    const data = report.data;
    if (!data) return null;
    const orders = data.orders.filter(o => o.entry_date >= from && o.entry_date <= to && o.status !== "cancelado");
    const orderIds = new Set(orders.map(o => o.id));
    const payments = data.payments.filter(p => p.paid_at.slice(0, 10) >= from && p.paid_at.slice(0, 10) <= to);
    const expenses = data.expenses.filter(e => e.expense_date >= from && e.expense_date <= to);
    const completions = data.completions.filter(c => c.completed_at.slice(0, 10) >= from && c.completed_at.slice(0, 10) <= to);
    const movements = data.movements.filter(m => m.movement_type === "saida" && m.created_at.slice(0, 10) >= from && m.created_at.slice(0, 10) <= to);
    const linked = movements.filter(m => m.service_order_id && orderIds.has(m.service_order_id));
    const knownCost = linked.reduce((sum, m) => sum + (m.unit_cost == null ? 0 : Number(m.quantity) * Number(m.unit_cost)), 0);
    const missingCost = linked.filter(m => m.unit_cost == null).length;
    const received = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const orderValue = orders.reduce((sum, o) => sum + Number(o.parts_value ?? 0) + Number(o.labor_value ?? 0), 0);
    const byCategory = new Map<string, number>();
    for (const expense of expenses) byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + Number(expense.amount));
    const byOrder = new Map<string, { cost: number; movements: number; missing: number }>();
    for (const movement of linked) {
      if (!movement.service_order_id) continue;
      const row = byOrder.get(movement.service_order_id) ?? { cost: 0, movements: 0, missing: 0 };
      row.movements += 1;
      if (movement.unit_cost == null) row.missing += 1;
      else row.cost += Number(movement.quantity) * Number(movement.unit_cost);
      byOrder.set(movement.service_order_id, row);
    }
    return {
      orders, orderValue, received, spent, cashBalance: received - spent,
      completed: completions.length, knownCost, missingCost,
      preliminary: received - spent - knownCost,
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      orderCosts: orders.map(order => ({ order, costs: byOrder.get(order.id) ?? null })).sort((a, b) => b.order.number - a.order.number),
      unlinkedExits: movements.filter(m => !m.service_order_id).length,
    };
  }, [report.data, from, to]);

  if (!isAdmin) return <section className="rounded-md border p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente o administrador pode acessar os indicadores financeiros.</p></section>;

  return <main className="space-y-6">
    <header className="space-y-1"><p className="text-sm text-muted-foreground">Gestão da oficina</p><h1 className="text-3xl">Indicadores e lucratividade</h1><p className="text-sm text-muted-foreground">Acompanhe produção, recebimentos, despesas e custo conhecido das peças vinculadas às OS.</p></header>
    <section className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4">
      <label className="grid gap-1 text-sm"><span className="text-muted-foreground">De</span><input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2"/></label>
      <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Até</span><input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2"/></label>
      <p className="pb-2 text-xs text-muted-foreground">{formatDateBR(from)} a {formatDateBR(to)}</p>
    </section>
    {report.isLoading ? <p className="rounded-md border p-6 text-sm text-muted-foreground">Carregando indicadores…</p> : report.isError ? <section className="rounded-md border border-destructive/40 p-5"><h2 className="font-semibold">Não foi possível carregar os indicadores</h2><p className="mt-1 text-sm text-muted-foreground">{report.error instanceof Error ? report.error.message : "Verifique se as tabelas financeiras e de estoque estão disponíveis."}</p></section> : summary && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<ClipboardCheck className="size-4"/>} label="OS registradas no período" value={String(summary.orders.length)} detail={`Valor total: ${formatBRL(summary.orderValue)}`}/>
        <Metric icon={<Activity className="size-4"/>} label="Serviços concluídos" value={String(summary.completed)} detail="Conclusões registradas no período"/>
        <Metric icon={<ArrowUpRight className="size-4"/>} label="Recebido no período" value={formatBRL(summary.received)} detail="Pagamentos efetivamente registrados"/>
        <Metric icon={<ArrowDownRight className="size-4"/>} label="Despesas no período" value={formatBRL(summary.spent)} detail="Despesas manuais lançadas"/>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric icon={<Wallet className="size-4"/>} label="Saldo de caixa do período" value={formatBRL(summary.cashBalance)} detail="Recebimentos menos despesas registradas"/>
        <Metric icon={<Package className="size-4"/>} label="Custo conhecido de peças nas OS" value={formatBRL(summary.knownCost)} detail="Somente saídas de estoque vinculadas a OS"/>
        <Metric icon={<Coins className="size-4"/>} label="Resultado preliminar" value={formatBRL(summary.preliminary)} detail="Caixa menos despesas e custo conhecido de peças; não é lucro líquido"/>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-3 rounded-md border bg-card p-4"><div><h2 className="font-semibold">Despesas por categoria</h2><p className="text-xs text-muted-foreground">Valores registrados no período selecionado.</p></div>
          {summary.byCategory.length ? <div className="space-y-3">{summary.byCategory.map(([category, amount]) => <div key={category}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{category}</span><strong>{formatBRL(amount)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${summary.spent > 0 ? Math.min(100, amount / summary.spent * 100) : 0}%` }}/></div></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma despesa registrada neste período.</p>}
        </div>
        <div className="space-y-3 rounded-md border bg-card p-4"><div><h2 className="font-semibold">Qualidade dos custos de estoque</h2><p className="text-xs text-muted-foreground">Ajuda a entender o quanto dos custos pode ser atribuído às ordens.</p></div>
          <p className="text-sm">Saídas vinculadas sem custo histórico: <strong>{summary.missingCost}</strong></p>
          <p className="text-sm">Saídas sem vínculo com OS: <strong>{summary.unlinkedExits}</strong></p>
          <p className="text-xs text-muted-foreground">A partir da nova rotina, saídas registram automaticamente o custo unitário vigente. Movimentos antigos sem custo não são preenchidos com valores atuais para não distorcer o histórico.</p>
        </div>
      </section>
      <section className="space-y-3"><div><h2 className="text-xl font-semibold">Custos de peças por ordem de serviço</h2><p className="text-sm text-muted-foreground">O custo aparece quando a saída de estoque é vinculada à OS. Isso não inclui peças compradas fora do estoque nem custo de mão de obra.</p></div>
        <div className="overflow-hidden rounded-md border bg-card divide-y">{summary.orderCosts.length ? summary.orderCosts.map(({order,costs}) => <article key={order.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div className="min-w-0"><p className="font-medium">OS {order.number} · {order.customer_name}</p><p className="text-xs text-muted-foreground">{order.vehicle} · {order.plate} · {order.status}</p></div><div className="text-sm"><p className="text-muted-foreground">Valor OS</p><strong>{formatBRL(Number(order.parts_value ?? 0) + Number(order.labor_value ?? 0))}</strong></div><div className="text-sm sm:text-right"><p className="text-muted-foreground">Custo de estoque vinculado</p><strong>{costs ? formatBRL(costs.cost) : "Sem baixa vinculada"}</strong>{costs?.missing ? <p className="text-xs text-warning">{costs.missing} saída(s) sem custo</p> : null}</div></article>) : <p className="p-6 text-sm text-muted-foreground">Nenhuma OS registrada neste período.</p>}</div>
      </section>
      <section className="rounded-md border border-warning/40 p-4"><h2 className="font-semibold">Como interpretar o resultado</h2><p className="mt-1 text-sm text-muted-foreground">O resultado preliminar é um indicador gerencial, não lucro líquido nem margem contábil: ainda não desconta salários, encargos, impostos não lançados, custos de peças sem vínculo e outros custos não registrados. O valor total das OS também não representa dinheiro recebido. Para uma margem confiável, registre toda saída de peça vinculada à OS e todos os custos operacionais.</p></section>
    </>}
  </main>;
}
