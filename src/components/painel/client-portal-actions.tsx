import { useState } from "react";
import { Copy, Link2, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function ClientPortalActions({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("issue_client_portal_link", { _order_id: orderId });
    setBusy(false);
    if (error || !data?.token) {
      toast.error("Não foi possível gerar o link de acompanhamento.");
      return;
    }
    const url = new URL(`/acompanhar/${data.token}`, window.location.origin).toString();
    setLink(url);
    setExpiresAt(data.expires_at);
    toast.success("Link de acompanhamento criado por 30 dias.");
  }

  async function revoke() {
    setBusy(true);
    const { error } = await (supabase as any).rpc("revoke_client_portal_link", { _order_id: orderId });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível revogar o link.");
      return;
    }
    setLink(null);
    setExpiresAt(null);
    toast.success("Acesso do cliente revogado.");
  }

  return (
    <section className="space-y-3 rounded-md border border-border p-4 print:hidden">
      <div>
        <h2 className="font-semibold">Acompanhamento do cliente</h2>
        <p className="text-sm text-muted-foreground">Gere um link privado para esta OS. O acesso vence em 30 dias e pode ser revogado.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void issue()}>
          {busy ? <Loader2 className="animate-spin" /> : <Link2 />}
          {link ? "Gerar novo link" : "Gerar link do cliente"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void revoke()}>
          <ShieldOff /> Revogar acesso
        </Button>
      </div>
      {link && (
        <div className="space-y-2 rounded-md bg-muted p-3">
          <p className="break-all text-sm">{link}</p>
          <p className="text-xs text-muted-foreground">Válido até {expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : "—"}. Gere outro link para substituir este.</p>
          <Button type="button" size="sm" onClick={async () => {
            try { await navigator.clipboard.writeText(link); toast.success("Link copiado."); }
            catch { toast.error("Não foi possível copiar o link."); }
          }}><Copy /> Copiar link</Button>
        </div>
      )}
    </section>
  );
}
