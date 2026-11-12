import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type SignatureEvent = "vehicle_receipt" | "vehicle_delivery";
type SignatureRow = {
  id: string;
  event_type: SignatureEvent;
  signer_name: string;
  signer_relation: string;
  consent_text: string;
  signed_at: string;
};

const eventLabels: Record<SignatureEvent, string> = {
  vehicle_receipt: "Recebimento do veículo",
  vehicle_delivery: "Entrega do veículo",
};

export function OrderSignatures({ order }: { order: { id: string; number: number; status: string } }) {
  const qc = useQueryClient();
  const [eventType, setEventType] = useState<SignatureEvent | null>(null);
  const [signerName, setSignerName] = useState("");
  const [relation, setRelation] = useState("Cliente");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: signatures = [], isLoading } = useQuery({
    queryKey: ["order-signatures", order.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_order_signatures")
        .select("id,event_type,signer_name,signer_relation,consent_text,signed_at")
        .eq("service_order_id", order.id)
        .order("signed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SignatureRow[];
    },
  });

  const receiptSigned = signatures.some((s) => s.event_type === "vehicle_receipt");
  const deliverySigned = signatures.some((s) => s.event_type === "vehicle_delivery");
  const canReceipt = order.status === "recebido" && !receiptSigned;
  const canDelivery = ["pronto", "entregue"].includes(order.status) && !deliverySigned;

  async function submit() {
    if (!eventType || !signerName.trim() || !relation.trim() || !consent) {
      toast.error("Preencha o nome, o vínculo e confirme a declaração antes de registrar.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("record_order_signature", {
        _order_id: order.id,
        _event_type: eventType,
        _signer_name: signerName.trim(),
        _signer_relation: relation.trim(),
        _consent: true,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["order-signatures", order.id] });
      setEventType(null);
      setSignerName("");
      setRelation("Cliente");
      setConsent(false);
      toast.success("Assinatura registrada e protegida contra edição.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a assinatura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-5">
      <div>
        <h2 className="font-display text-lg uppercase">Assinaturas eletrônicas</h2>
        <p className="text-sm text-muted-foreground">A aprovação do orçamento permanece no fluxo próprio de aprovação. Aqui ficam os registros de recebimento e entrega.</p>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando assinaturas...</p> : signatures.length > 0 ? (
        <div className="space-y-3">
          {signatures.map((signature) => (
            <div key={signature.id} className="flex items-start gap-3 rounded-md border border-border p-3">
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
              <div className="min-w-0">
                <p className="font-medium">{eventLabels[signature.event_type]}</p>
                <p className="text-sm">{signature.signer_name} · {signature.signer_relation}</p>
                <p className="text-xs text-muted-foreground">{new Date(signature.signed_at).toLocaleString("pt-BR")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{signature.consent_text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Nenhuma assinatura de recebimento ou entrega registrada.</p>}

      {!eventType && (canReceipt || canDelivery) && (
        <div className="flex flex-wrap gap-2">
          {canReceipt && <Button type="button" variant="outline" onClick={() => setEventType("vehicle_receipt")}><PenLine /> Assinar recebimento</Button>}
          {canDelivery && <Button type="button" variant="outline" onClick={() => setEventType("vehicle_delivery")}><PenLine /> Assinar entrega</Button>}
        </div>
      )}

      {eventType && (
        <div className="space-y-3 rounded-md border border-primary/30 p-4">
          <h3 className="font-semibold">{eventLabels[eventType]} · OS nº {order.number}</h3>
          <p className="text-sm text-muted-foreground">O cliente ou responsável deve ler a declaração e preencher os dados pessoalmente no dispositivo da oficina.</p>
          <div className="space-y-2">
            <Label htmlFor={"signature-name-" + order.id}>Nome completo do signatário</Label>
            <Input id={"signature-name-" + order.id} value={signerName} onChange={(e) => setSignerName(e.target.value)} maxLength={120} autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={"signature-relation-" + order.id}>Vínculo com o veículo</Label>
            <Input id={"signature-relation-" + order.id} value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={80} placeholder="Cliente, proprietário ou responsável" />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>Li e concordo com a declaração de {eventLabels[eventType].toLowerCase()} acima. Autorizo o registro eletrônico do meu nome, da data e hora e do documento desta OS.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !consent || signerName.trim().length < 3 || relation.trim().length < 2} onClick={submit}>{busy ? <Loader2 className="animate-spin" /> : <PenLine />} Confirmar assinatura</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setEventType(null); setConsent(false); }}>Cancelar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Registro eletrônico simples com trilha de auditoria. Não equivale, por si só, a uma assinatura qualificada ICP-Brasil.</p>
        </div>
      )}
    </section>
  );
}
