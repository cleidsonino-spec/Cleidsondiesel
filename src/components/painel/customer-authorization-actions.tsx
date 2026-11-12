import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Authorization = {
  id: string;
  authorization_type: "execution_authorization" | "delivery_confirmation";
  signer_name: string;
  accepted_at: string;
  consent_text: string;
};

export function CustomerAuthorizationActions({
  orderId,
  orderStatus,
}: {
  orderId: string;
  orderStatus: string;
}) {
  const queryClient = useQueryClient();
  const [signerName, setSignerName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const authorizationType =
    orderStatus === "pronto"
      ? "delivery_confirmation"
      : orderStatus === "aprovado_aguardando_encaminhamento"
        ? "execution_authorization"
        : null;

  const authorizationQuery = useQuery({
    queryKey: ["customer-authorizations", orderId],
    enabled: Boolean(authorizationType),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_authorizations")
        .select("id,authorization_type,signer_name,accepted_at,consent_text")
        .eq("service_order_id", orderId);
      if (error) throw error;
      return (data ?? []) as Authorization[];
    },
  });

  if (!authorizationType) return null;

  const authorization = authorizationQuery.data?.find(
    (item) => item.authorization_type === authorizationType,
  );
  const isDelivery = authorizationType === "delivery_confirmation";

  async function recordAuthorization() {
    if (signerName.trim().length < 3) {
      toast.error("Informe o nome de quem está autorizando.");
      return;
    }
    if (!accepted) {
      toast.error("A confirmação presencial do cliente é obrigatória.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("record_customer_authorization", {
      _order_id: orderId,
      _authorization_type: authorizationType,
      _signer_name: signerName.trim(),
      _accepted: true,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível registrar a autorização.");
      return;
    }
    toast.success(isDelivery ? "Confirmação de entrega registrada." : "Autorização de execução registrada.");
    setSignerName("");
    setAccepted(false);
    await queryClient.invalidateQueries({ queryKey: ["customer-authorizations", orderId] });
    await queryClient.invalidateQueries({ queryKey: ["service-order-status-history", orderId] });
  }

  async function finalizeDelivery() {
    setFinalizing(true);
    const { error } = await supabase.rpc("finalize_service_order_delivery", {
      _order_id: orderId,
    });
    setFinalizing(false);
    if (error) {
      toast.error(error.message || "Não foi possível finalizar a entrega.");
      return;
    }
    toast.success("Entrega física registrada. OS finalizada.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      queryClient.invalidateQueries({ queryKey: ["orders", orderId] }),
      queryClient.invalidateQueries({ queryKey: ["service-order-status-history", orderId] }),
    ]);
  }

  return (
    <section className="space-y-3 rounded-md border bg-card p-4 print:hidden">
      <div className="flex items-center gap-2">
        {isDelivery ? <Truck className="size-5 text-primary" /> : <ClipboardCheck className="size-5 text-primary" />}
        <div>
          <h2 className="font-semibold">{isDelivery ? "Confirmação da entrega do veículo" : "Autorização para execução do serviço"}</h2>
          <p className="text-sm text-muted-foreground">
            {isDelivery
              ? "Registre o aceite somente quando o cliente ou representante estiver presente e confirmar o recebimento."
              : "Registre o aceite do cliente ou representante para executar o serviço conforme o orçamento aprovado."}
          </p>
        </div>
      </div>

      {authorizationQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Consultando autorizações…</p>
      ) : authorizationQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">Não foi possível consultar o histórico de autorizações.</p>
      ) : authorization ? (
        <div className="space-y-2 rounded-md bg-muted p-3">
          <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4 text-success" />Aceite registrado</p>
          <p className="text-sm">Nome informado: <strong>{authorization.signer_name}</strong></p>
          <p className="text-xs text-muted-foreground">Registrado em {new Date(authorization.accepted_at).toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">{authorization.consent_text}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`authorization-name-${orderId}`}>Nome de quem está autorizando *</Label>
            <Input
              id={`authorization-name-${orderId}`}
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              maxLength={120}
              minLength={3}
              placeholder="Nome do cliente ou representante presente"
            />
          </div>
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 size-4"
            />
            <span>
              {isDelivery
                ? "Confirmo que o cliente ou representante presente declarou ter recebido o veículo e conferido a entrega."
                : "Confirmo que o cliente ou representante presente autorizou a execução conforme o orçamento aprovado."}
            </span>
          </label>
          <Button type="button" onClick={() => void recordAuthorization()} disabled={saving || !accepted || signerName.trim().length < 3}>
            {saving ? "Registrando…" : "Registrar confirmação"}
          </Button>
        </div>
      )}

      {isDelivery && authorization && (
        <Button type="button" onClick={() => void finalizeDelivery()} disabled={finalizing}>
          {finalizing ? "Finalizando entrega…" : "Confirmar entrega e finalizar OS"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        O registro usa nome digitado e confirmação pela equipe; não é assinatura digital certificada nem verificação independente de identidade.
      </p>
    </section>
  );
}
