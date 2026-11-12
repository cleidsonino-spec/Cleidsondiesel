import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardSignature, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel/assinaturas")({
  head: () => ({ meta: [{ title: "Autorizações e assinaturas — Cleidson Diesel" }, { name: "robots", content: "noindex" }] }),
  component: AuthorizationsPage,
});

type Order = {
  id: string;
  number: number;
  customer_name: string;
  plate: string;
  vehicle: string;
  status: string;
};
type Authorization = {
  id: string;
  service_order_id: string;
  authorization_type: "execution_authorization" | "delivery_confirmation";
  signer_name: string;
  consent_text: string;
  accepted_at: string;
};

const typeLabel = (type: Authorization["authorization_type"]) =>
  type === "execution_authorization" ? "Autorização de execução" : "Confirmação de entrega";

function AuthorizationsPage() {
  const { isAdmin, isSecretary } = Route.useRouteContext();
  const qc = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const [kind, setKind] = useState<Authorization["authorization_type"]>("execution_authorization");
  const [signer, setSigner] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizingId, setFinalizingId] = useState("");

  const query = useQuery({
    queryKey: ["customer-authorizations"],
    enabled: isAdmin || isSecretary,
    queryFn: async () => {
      const [orders, records] = await Promise.all([
        supabase.from("service_orders").select("id,number,customer_name,plate,vehicle,status").neq("status", "cancelado").order("number", { ascending: false }).limit(500),
        (supabase as any).from("customer_authorizations").select("id,service_order_id,authorization_type,signer_name,consent_text,accepted_at").order("accepted_at", { ascending: false }).limit(1000),
      ]);
      if (orders.error) throw orders.error;
      if (records.error) throw records.error;
      return { orders: (orders.data ?? []) as Order[], records: (records.data ?? []) as Authorization[] };
    },
  });

  const orders = query.data?.orders ?? [];
  const records = query.data?.records ?? [];
  const selected = orders.find((item) => item.id === orderId);
  const eligible = useMemo(() => orders.filter((item) => {
    const alreadyRecorded = records.some((record) =>
      record.service_order_id === item.id && record.authorization_type === kind
    );
    if (alreadyRecorded) return false;
    return kind === "execution_authorization"
      ? item.status === "aprovado_aguardando_encaminhamento"
      : item.status === "pronto";
  }), [orders, records, kind]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) { toast.error("Selecione uma ordem de serviço elegível."); return; }
    if (records.some((record) => record.service_order_id === selected.id && record.authorization_type === kind)) {
      toast.error("Este aceite já foi registrado para esta OS.");
      return;
    }
    if (!signer.trim() || !accepted) { toast.error("Informe o nome e confirme o aceite do cliente."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("record_customer_authorization", {
        _order_id: selected.id,
        _authorization_type: kind,
        _signer_name: signer.trim(),
        _accepted: accepted,
      });
      if (error) throw error;
      toast.success("Aceite registrado no histórico da ordem de serviço.");
      setOrderId(""); setSigner(""); setAccepted(false);
      await qc.invalidateQueries({ queryKey: ["customer-authorizations"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o aceite.");
    } finally {
      setSaving(false);
    }
  }

  async function finalizeDelivery(serviceOrderId: string) {
    setFinalizingId(serviceOrderId);
    try {
      const { error } = await (supabase as any).rpc("finalize_service_order_delivery", {
        _order_id: serviceOrderId,
      });
      if (error) throw error;
      toast.success("Entrega finalizada. A OS agora está marcada como entregue.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["customer-authorizations"] }),
        qc.invalidateQueries({ queryKey: ["orders"] }),
        qc.invalidateQueries({ queryKey: ["orders", serviceOrderId] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a entrega.");
    } finally {
      setFinalizingId("");
    }
  }

  if (!isAdmin && !isSecretary) return <section className="rounded-md border p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente administração e secretaria podem registrar autorizações.</p></section>;

  return <div className="space-y-6">
    <header>
      <p className="text-sm text-muted-foreground">Histórico de aceite do cliente</p>
      <h1 className="flex items-center gap-2 text-3xl"><ClipboardSignature className="text-primary" />Autorizações e assinaturas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Registre a autorização de execução e a confirmação de entrega, vinculadas à OS.</p>
    </header>

    <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" />Como funciona nesta versão</p>
      <p className="mt-1 text-muted-foreground">O cliente confere o texto, informa o nome e confirma o aceite na presença da equipe. O sistema registra data, hora, responsável e OS. Este aceite eletrônico digitado não é assinatura manuscrita, certificado ICP-Brasil ou garantia automática de validade jurídica.</p>
    </div>

    {query.isLoading ? <p className="rounded-md border p-5 text-sm">Carregando ordens…</p> : query.isError ? <p className="rounded-md border border-destructive/40 p-5 text-sm">Não foi possível carregar os dados. {query.error instanceof Error ? query.error.message : ""}</p> : <>
      <form onSubmit={save} className="space-y-4 rounded-md border bg-card p-5">
        <h2 className="font-semibold">Registrar novo aceite</h2>
        <div className="space-y-2">
          <Label htmlFor="authorization-kind">Tipo de autorização</Label>
          <select id="authorization-kind" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={kind} onChange={(event) => { setKind(event.target.value as Authorization["authorization_type"]); setOrderId(""); }}>
            <option value="execution_authorization">Autorização para execução</option>
            <option value="delivery_confirmation">Confirmação de entrega</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorization-order">Ordem de serviço</Label>
          <select id="authorization-order" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
            <option value="">Selecione uma OS</option>
            {eligible.map((item) => <option key={item.id} value={item.id}>OS {item.number} · {item.customer_name} · {item.plate} · {item.vehicle}</option>)}
          </select>
        </div>
        {selected && <div className="rounded-md bg-muted p-3 text-sm"><strong>OS {selected.number} · {selected.plate}</strong><p className="text-muted-foreground">{selected.customer_name} · {selected.vehicle}</p></div>}
        <div className="space-y-2">
          <Label htmlFor="authorization-signer">Nome completo de quem autoriza</Label>
          <Input id="authorization-signer" required minLength={3} maxLength={120} value={signer} onChange={(event) => setSigner(event.target.value)} autoComplete="name" />
        </div>
        {selected && <div className="rounded-md border p-4">
          <p className="text-sm font-medium">Texto que o cliente está aceitando</p>
          <p className="mt-2 text-sm text-muted-foreground">{kind === "execution_authorization"
            ? "Confirmo que fui informado(a) sobre o serviço descrito na ordem de serviço e autorizo a execução conforme o orçamento aprovado."
            : "Confirmo o recebimento do veículo e declaro que pude conferir sua entrega e os serviços registrados nesta ordem de serviço."}</p>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 size-4" />
            <span>O cliente leu e confirmou o aceite do texto acima.</span>
          </label>
        </div>}
        <Button type="submit" disabled={saving || !selected || !accepted}>{saving ? "Registrando…" : "Registrar autorização"}</Button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Histórico de autorizações</h2>
        {records.map((record) => {
          const order = orders.find((item) => item.id === record.service_order_id);
          return <article key={record.id} className="space-y-1 rounded-md border p-4">
            <p className="font-semibold">{typeLabel(record.authorization_type)} · OS {order?.number ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{order?.customer_name ?? "Cliente"} · {order?.plate ?? "—"} · {order?.vehicle ?? ""}</p>
            <p className="text-sm">Autorizado por: {record.signer_name}</p>
            <p className="text-xs text-muted-foreground">{new Date(record.accepted_at).toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">{record.consent_text}</p>
            {record.authorization_type === "delivery_confirmation" && order?.status === "pronto" && (
              <Button
                type="button"
                size="sm"
                disabled={finalizingId === order.id}
                onClick={() => void finalizeDelivery(order.id)}
              >
                {finalizingId === order.id ? "Finalizando…" : "Finalizar entrega da OS"}
              </Button>
            )}
          </article>;
        })}
        {records.length === 0 && <p className="rounded-md border p-5 text-sm text-muted-foreground">Nenhuma autorização registrada.</p>}
      </section>
    </>}
  </div>;
}
