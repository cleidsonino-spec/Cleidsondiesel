import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { approvalUrl } from "@/lib/approval";
import { quoteMessage, waLink } from "@/lib/whatsapp";

export function ApprovalActions({ order }: { order: Database["public"]["Tables"]["service_orders"]["Row"] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ["approval", order.id, order.updated_at], refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from("quote_approvals").select("id,token,state,expires_at,approved_at,approved_by").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const active = data && data.state !== "revoked" && Date.parse(data.expires_at) > Date.now() ? data : null;
  const url = active ? approvalUrl(active.token) : null;
  const href = url ? waLink(order.phone, quoteMessage(order, url)) : null;
  async function issue() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("issue_quote_approval", { _order_id: order.id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["approval", order.id] });
      toast.success("Link de aprovação criado.");
    } catch { toast.error("Não foi possível criar o link de aprovação."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-y border-border py-5 print:hidden">
    <h2 className="text-lg">Aprovação do orçamento</h2>
    {active?.state === "approved" && <p role="status" className="text-success">Aprovado por {active.approved_by} em {new Date(active.approved_at ?? "").toLocaleString("pt-BR")}</p>}
    {active?.state === "pending" && <p className="text-muted-foreground">Aguardando aprovação · válido até {new Date(active.expires_at).toLocaleDateString("pt-BR")}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={busy || ["pronto", "entregue", "cancelado"].includes(order.status)} onClick={issue}>{busy ? <Loader2 className="animate-spin" /> : <Link2 />}{active ? "Gerar novo link" : "Gerar link de aprovação"}</Button>
      {url && <Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Link copiado."); } catch { toast.error("Não foi possível copiar o link."); } }}><Copy /> Copiar link</Button>}
      {href && <Button asChild><a href={href} target="_blank" rel="noopener noreferrer"><MessageCircle /> Enviar link no WhatsApp</a></Button>}
    </div>
  </section>;
}