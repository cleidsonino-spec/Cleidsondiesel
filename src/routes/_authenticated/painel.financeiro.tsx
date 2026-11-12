import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowUpRight, ReceiptText, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/status";
import { formatDateBR, todayISO } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/painel/financeiro")({
  head: () => ({ meta: [
    { title: "Financeiro — Cleidson Diesel" },
    { name: "description", content: "Controle financeiro manual da oficina." },
    { name: "robots", content: "noindex" },
  ] }),
  component: FinancialPage,
});

type Payment = {
  id: string;
  service_order_id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  notes: string | null;
};
type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  supplier_name: string | null;
};
type Order = {
  id: string;
  number: number;
  customer_name: string;
  plate: string;
  vehicle: string;
  parts_value: number;
  labor_value: number;
  status: string;
};

const methods = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

function localDate(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
function FinancialPage() {
  const { isAdmin } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const today = todayISO();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [paymentOrder, setPaymentOrder] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Operacional");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseMethod, setExpenseMethod] = useState("pix");
  const [expenseSupplier, setExpenseSupplier] = useState("");
  const [saving, setSaving] = useState(false);

  const finance = useQuery({
    queryKey: ["financial-dashboard"],
    enabled: isAdmin,
    queryFn: async () => {
      const [ordersResult, paymentsResult, expensesResult] = await Promise.all([
        supabase.from("service_orders").select("id,number,customer_name,plate,vehicle,parts_value,labor_value,status").order("number", { ascending: false }).limit(1000),
        (supabase as any).from("service_order_payments").select("id,service_order_id,amount,payment_method,paid_at,notes").order("paid_at", { ascending: false }).limit(2000),
        (supabase as any).from("shop_expenses").select("id,description,category,amount,expense_date,payment_method,supplier_name").order("expense_date", { ascending: false }).limit(2000),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (expensesResult.error) throw expensesResult.error;
      return {
        orders: (ordersResult.data ?? []) as Order[],
        payments: (paymentsResult.data ?? []) as Payment[],
        expenses: (expensesResult.data ?? []) as Expense[],
      };
    },
  });

  const summary = useMemo(() => {
    const data = finance.data;
    if (!data) return { received: 0, expenses: 0, balance: 0, receivable: 0, outstanding: [] as { order: Order; paid: number; due: number }[] };
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${shiftDate(to, 1)}T00:00:00`);
    const payments = data.payments.filter((p) => {
      const date = new Date(p.paid_at);
      return date >= start && date < end;
    });
    const expenses = data.expenses.filter((e) => e.expense_date >= from && e.expense_date <= to);
    const received = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const paidByOrder = new Map<string, number>();
    for (const p of data.payments) paidByOrder.set(p.service_order_id, (paidByOrder.get(p.service_order_id) ?? 0) + Number(p.amount));
    const outstanding = data.orders
      .filter((o) => o.status !== "cancelado")
      .map((order) => {
        const total = Number(order.parts_value ?? 0) + Number(order.labor_value ?? 0);
        const paid = paidByOrder.get(order.id) ?? 0;
        return { order, paid, due: Math.max(0, total - paid) };
      })
      .filter((row) => row.due > 0)
      .sort((a, b) => b.due - a.due);
    return {
      received,
      expenses: spent,
      balance: received - spent,
      receivable: outstanding.reduce((sum, row) => sum + row.due, 0),
      outstanding,
    };
  }, [finance.data, from, to]);

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentOrder || !paymentAmount.trim()) return;
    const amount = Number(paymentAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor de recebimento válido.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("service_order_payments").insert({
      service_order_id: paymentOrder,
      amount,
      payment_method: paymentMethod,
      notes: paymentNotes.trim() || null,
      created_by: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível registrar o recebimento.");
      return;
    }
    toast.success("Recebimento registrado.");
    setPaymentAmount("");
    setPaymentNotes("");
    await queryClient.invalidateQueries({ queryKey: ["financial-dashboard"] });
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(expenseAmount.replace(",", "."));
    if (!expenseDescription.trim() || !expenseCategory.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Preencha descrição, categoria e um valor válido.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("shop_expenses").insert({
      description: expenseDescription.trim(),
      category: expenseCategory.trim(),
      amount,
      expense_date: expenseDate,
      payment_method: expenseMethod,
      supplier_name: expenseSupplier.trim() || null,
      created_by: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível registrar a despesa.");
      return;
    }
    toast.success("Despesa registrada.");
    setExpenseDescription("");
    setExpenseAmount("");
    setExpenseSupplier("");
    await queryClient.invalidateQueries({ queryKey: ["financial-dashboard"] });
  }

  if (!isAdmin) return <section className="rounded-md border p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente o administrador da oficina pode acessar o financeiro.</p></section>;

  const data = finance.data;
  const selectedOrder = data?.orders.find((order) => order.id === paymentOrder);
  const orderPaid = selectedOrder ? data?.payments.filter((payment) => payment.service_order_id === selectedOrder.id).reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0 : 0;
  const orderDue = selectedOrder ? Math.max(0, Number(selectedOrder.parts_value) + Number(selectedOrder.labor_value) - orderPaid) : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Gestão da oficina</p>
        <h1 className="text-3xl">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Registre pagamentos efetivamente recebidos e despesas realizadas. Aprovação de orçamento não é recebimento.</p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4">
        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">De</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" /></label>
        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Até</span><input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" /></label>
        <p className="pb-2 text-xs text-muted-foreground">{formatDateBR(from)} a {formatDateBR(to)}</p>
      </section>

      {finance.isLoading ? <p className="rounded-md border p-6 text-sm text-muted-foreground">Carregando financeiro…</p> : finance.isError ? (
        <div className="rounded-md border border-destructive/40 p-5"><h2 className="font-semibold">Não foi possível carregar o financeiro</h2><p className="mt-1 text-sm text-muted-foreground">{finance.error instanceof Error ? finance.error.message : "Verifique a estrutura financeira no banco."}</p></div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<ArrowUpRight />} label="Recebido no período" value={formatBRL(summary.received)} />
            <Metric icon={<ArrowDownRight />} label="Despesas no período" value={formatBRL(summary.expenses)} />
            <Metric icon={<Wallet />} label="Saldo do período" value={formatBRL(summary.balance)} />
            <Metric icon={<ReceiptText />} label="A receber nas OS" value={formatBRL(summary.receivable)} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <form onSubmit={addPayment} className="space-y-3 rounded-md border bg-card p-4">
              <div><h2 className="font-semibold">Registrar recebimento</h2><p className="text-xs text-muted-foreground">Pagamento integral ou parcial vinculado a uma OS.</p></div>
              <label className="grid gap-1 text-sm"><span>Ordem de serviço</span><select required value={paymentOrder} onChange={(e) => setPaymentOrder(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2"><option value="">Selecione a OS</option>{(data?.orders ?? []).filter((o) => o.status !== "cancelado").map((o) => <option key={o.id} value={o.id}>OS {o.number} · {o.customer_name} · {o.plate}</option>)}</select></label>
              {selectedOrder && <p className="text-xs text-muted-foreground">Saldo desta OS: <strong>{formatBRL(orderDue)}</strong></p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm"><span>Valor recebido (R$)</span><input required type="number" min="0.01" step="0.01" max={orderDue || undefined} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" /></label>
                <label className="grid gap-1 text-sm"><span>Forma de pagamento</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2">{methods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
              </div>
              <label className="grid gap-1 text-sm"><span>Observação (opcional)</span><input maxLength={1000} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" /></label>
              <Button type="submit" disabled={saving || !selectedOrder || orderDue <= 0}>{saving ? "Salvando…" : "Registrar recebimento"}</Button>
            </form>

            <form onSubmit={addExpense} className="space-y-3 rounded-md border bg-card p-4">
              <div><h2 className="font-semibold">Registrar despesa</h2><p className="text-xs text-muted-foreground">Despesas avulsas da oficina, sem duplicar compras de estoque.</p></div>
              <label className="grid gap-1 text-sm"><span>Descrição</span><input required minLength={2} maxLength={180} value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" placeholder="Ex.: conta de energia" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm"><span>Categoria</span><select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2">{["Operacional","Aluguel","Energia","Água","Internet","Ferramentas","Manutenção","Impostos","Transporte","Outros"].map((category) => <option key={category}>{category}</option>)}</select></label>
                <label className="grid gap-1 text-sm"><span>Valor (R$)</span><input required type="number" min="0.01" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm"><span>Data da despesa</span><input required type="date" max={today} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" /></label>
                <label className="grid gap-1 text-sm"><span>Forma de pagamento</span><select value={expenseMethod} onChange={(e) => setExpenseMethod(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2">{methods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
              </div>
              <label className="grid gap-1 text-sm"><span>Fornecedor (opcional)</span><input maxLength={160} value={expenseSupplier} onChange={(e) => setExpenseSupplier(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" /></label>
              <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Registrar despesa"}</Button>
            </form>
          </section>

          <section className="space-y-3">
            <div><h2 className="text-xl font-semibold">Contas a receber</h2><p className="text-sm text-muted-foreground">Saldo calculado pelo total da OS menos os recebimentos registrados, incluindo ordens já entregues.</p></div>
            {summary.outstanding.length ? <div className="overflow-hidden rounded-md border bg-card divide-y">{summary.outstanding.map(({ order, paid, due }) => <article key={order.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><p className="font-medium">OS {order.number} · {order.customer_name}</p><p className="text-xs text-muted-foreground">{order.vehicle} · {order.plate} · Recebido: {formatBRL(paid)}</p></div><p className="font-semibold tabular-nums">{formatBRL(due)}</p></article>)}</div> : <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma OS com saldo em aberto.</p>}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-3"><h2 className="text-xl font-semibold">Últimos recebimentos</h2><div className="rounded-md border bg-card divide-y">{(data?.payments ?? []).slice(0, 12).length ? (data?.payments ?? []).slice(0, 12).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-medium">OS {(data?.orders ?? []).find((o) => o.id === payment.service_order_id)?.number ?? "—"}</p><p className="text-xs text-muted-foreground">{formatDateBR(payment.paid_at.slice(0, 10))} · {methods.find((m) => m.value === payment.payment_method)?.label ?? payment.payment_method}</p></div><strong className="text-sm">{formatBRL(Number(payment.amount))}</strong></div>) : <p className="p-5 text-sm text-muted-foreground">Nenhum recebimento registrado.</p>}</div></div>
            <div className="space-y-3"><h2 className="text-xl font-semibold">Últimas despesas</h2><div className="rounded-md border bg-card divide-y">{(data?.expenses ?? []).slice(0, 12).length ? (data?.expenses ?? []).slice(0, 12).map((expense) => <div key={expense.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{expense.description}</p><p className="text-xs text-muted-foreground">{formatDateBR(expense.expense_date)} · {expense.category}</p></div><strong className="text-sm">{formatBRL(Number(expense.amount))}</strong></div>) : <p className="p-5 text-sm text-muted-foreground">Nenhuma despesa registrada.</p>}</div></div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="rounded-md border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></article>;
}
