import { useState } from "react";
import { Copy, Link2, Loader2, MessageCircle, RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type IssuedAccess = { token: string; expires_at: string };

export function CustomerPortalActions({ orderId, orderNumber, phone, orderStatus }: { orderId: string; orderNumber: number; phone: string | null; orderStatus: string }) {
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<IssuedAccess | null>(null);
  const url = access && typeof window !== "undefined"
    ? `${window.location.origin}/consulta?token=${encodeURIComponent(access.token)}`
    : null;
  const phoneDigits = (phone ?? "").replace(/\D/g, "");
  const whatsappUrl = url && phoneDigits.length >= 10
    ? `https://wa.me/55${phoneDigits.startsWith("55") ? phoneDigits.slice(2) : phoneDigits}?text=${encodeURIComponent(`Olá! Acompanhe sua ordem de serviço nº ${orderNumber} na Cleidson Diesel por este link individual: ${url}`)}`
    : null;

  async function revoke() {\n    if (!window.confirm("Revogar imediatamente todos os links ativos de acompanhamento desta OS? O cliente perderá o acesso.")) return;\n    setBusy(true);\n    try {\n      const { data, error } = await supabase.rpc("revoke_customer_portal_access", { _order_id: orderId });\n      if (error) throw error;\n      setAccess(null);\n      toast.success(Number(data) > 0 ? "Link de acompanhamento revogado." : "Não havia link ativo para revogar.");\n    } catch {\n      toast.error("Não foi possível revogar o link de acompanhamento.");\n    } finally {\n      setBusy(false);\n    }\n  }\n\n  async function issue() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("issue_customer_portal_access", { _order_id: orderId });
      if (error) throw error;
      const result = data as unknown as IssuedAccess;
      if (!result?.token || !/^[a-f0-9]{64}$/.test(result.token)) throw new Error("Resposta inválida ao gerar acesso");
      setAccess(result);
      toast.success("Link individual de acompanhamento gerado. Links anteriores foram revogados.");
    } catch {
      toast.error("Não foi possível gerar o link de acompanhamento.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-3 rounded-md border border-border p-4 print:hidden">
    <div><h2 className="flex items-center gap-2 font-semibold"><Link2 className="size-4" /> Acompanhamento do cliente</h2>
      <p className="mt-1 text-sm text-muted-foreground">Gere um link individual com validade de 30 dias. Ao gerar outro, o link anterior deixa de funcionar.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={busy || orderStatus === "cancelado"} onClick={() => void issue()}>
        {busy ? <Loader2 className="animate-spin" /> : access ? <RefreshCw /> : <Link2 />}
        {access ? "Gerar novo link" : "Gerar link do cliente"}
      </Button>
      {url && <Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Link copiado."); } catch { toast.error("Não foi possível copiar o link."); } }}><Copy /> Copiar link</Button>}
      {whatsappUrl && <Button asChild><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle /> Enviar pelo WhatsApp</a></Button>}
    </div>
    {access && <p className="break-all text-xs text-muted-foreground">Link válido até {new Date(access.expires_at).toLocaleString("pt-BR")}. Compartilhe somente com o cliente responsável pela OS.</p>}
    {access && !whatsappUrl && <p className="text-xs text-muted-foreground">Cadastre um telefone com DDD na OS para habilitar o envio pelo WhatsApp.</p>}
  </section>;
}
