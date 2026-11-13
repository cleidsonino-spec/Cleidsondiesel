import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, orderTotal } from "@/lib/status";

type Payment = {
  payment_id: string;
  amount: number;
  note: string | null;
  confirmed_at: string;
  confirmed_by: string;
  confirmed_by_name: string;
};

export function OrderPayments({ orderId, partsValue, laborValue }: {
  orderId: string;
  partsValue: number | string | null;
  laborValue: number | string | null;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const total = orderTotal(partsValue, laborValue);
  const { data: payments = [], isLoading, isError } = useQuery<Payment[]>({
    queryKey: ["order-payments", orderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_service_order_payment_history", { _order_id: orderId });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });
  const received = payments.reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = Math.max(total - received, 0);
  const percent = total > 0 ? Math.min(100, (received / total) * 100) : 0;

  async function confirmPayment() {
    const rawAmount = amount.trim();
    const parsed = rawAmount.includes(",")
      ? Number(rawAmount.replace(/\\./g, "").replace(",", "."))
      : Number(rawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("confirm_service_order_payment", {
        _order_id: orderId,
        _amount: parsed,
        _note: note.trim() || null,
      });
      if (error) throw error;
      setAmount("");
      setNote("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["order-payments", orderId] }),
        qc.invalidateQueries({ queryKey: ["financial-overview"] }),
      ]);
      toast.success("Pagamento confirmado e registrado no financeiro.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="space-y-4 rounded-md border border-border bg-card p-4">
    <div className="flex items-center gap-2">
      <Wallet className="size-5 text-primary" />
      <div>
        <h2 className="font-semibold">Recebimentos da OS</h2>
        <p className="text-xs text-muted-foreground">Somente valores confirmados entram no financeiro.</p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric label="Orçamento" value={formatBRL(total)} />
      <Metric label="Recebido" value={formatBRL(received)} />
      <Metric label="Saldo pendente" value={formatBRL(balance)} />
      <Metric label="Pago" value={`${percent.toFixed(1).replace(".", ",")}%`} />
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
    </div>

    {balance > 0 && <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="space-y-1 text-sm">
        <span>Valor recebido (R$)</span>
        <Input inputMode="decimal" placeholder="Ex.: 500,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="space-y-1 text-sm">
        <span>Observação (opcional)</span>
        <Textarea rows={1} placeholder="Forma ou referência do pagamento" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button onClick={confirmPayment} disabled={saving || !amount.trim()}>
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
        Confirmar
      </Button>
    </div>}
    {balance <= 0 && total > 0 && <p className="text-sm font-medium text-success">OS quitada: não há saldo pendente.</p>}
    {isLoading ? <p className="text-sm text-muted-foreground">Carregando histórico…</p>
      : isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar o histórico de recebimentos.</p>
      : payments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pagamento confirmado nesta OS.</p>
      : <div className="space-y-2">
        <h3 className="text-sm font-semibold">Histórico de confirmações</h3>
        {payments.map((payment) => <div key={payment.payment_id} className="flex flex-wrap items-start justify-between gap-2 border-t border-border py-2 text-sm">
          <div><p className="font-medium">{formatBRL(Number(payment.amount))}</p>
            <p className="text-xs text-muted-foreground">{payment.confirmed_by_name || "Funcionário"} · {new Date(payment.confirmed_at).toLocaleString("pt-BR")}</p>
            {payment.note && <p className="text-xs text-muted-foreground">{payment.note}</p>}
          </div>
          <span className="text-xs text-success">Confirmado</span>
        </div>)}
      </div>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/50 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
  </div>;
}
