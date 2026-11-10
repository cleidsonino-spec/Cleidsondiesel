import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { createQuotePdf, defaultQuotePdfOptions, downloadQuote, type QuotePdfOptions } from "@/lib/quote-pdf";
import { waLink } from "@/lib/whatsapp";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];

export function QuotePdfActions({ order, message }: { order: Order; message?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");
  const [options, setOptions] = useState<QuotePdfOptions>(defaultQuotePdfOptions);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const metadata = user?.user_metadata ?? {};
      const name = [metadata["full_name"], metadata["name"], metadata["display_name"]].find(
        (value) => typeof value === "string" && value.trim(),
      );
      if (active) setPreparedBy(typeof name === "string" ? name.trim() : user?.email?.split("@")[0] ?? "Equipe Cleidson Diesel");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setFile(null);
    setFailed(false);
    createQuotePdf(order, preparedBy, options).then((pdf) => {
      if (active) setFile(pdf);
    }).catch(() => {
      if (active) { setFailed(true); toast.error("Não foi possível gerar o PDF. Reabra a ordem e tente novamente."); }
    });
    return () => { active = false; };
  }, [order, preparedBy, options]);

  function updateOption<K extends keyof QuotePdfOptions>(key: K, value: QuotePdfOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  async function shareWithCustomer() {
    if (!file) return;
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      downloadQuote(file);
      toast.message("PDF baixado. Anexe o arquivo ao enviar pelo WhatsApp ou outro aplicativo.");
      return;
    }
    try {
      await navigator.share({ files: [file], title: `Orçamento OS ${order.number} — Cleidson Diesel`, text: `Olá, ${order.customer_name}! Segue o orçamento da sua ordem de serviço.` });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o PDF. Tente baixá-lo.");
    }
  }

  function sendQuote() {
    if (!file) return;
    downloadQuote(file);
    const text = [message ?? "", preparedBy ? `Orçamento preparado por: ${preparedBy}` : ""].filter(Boolean).join("\n\n");
    const href = waLink(order.phone, text);
    if (href) { window.open(href, "_blank", "noopener,noreferrer"); toast.success("PDF baixado e WhatsApp do cliente aberto. Anexe o PDF na conversa."); }
    else toast.error("PDF baixado, mas falta um telefone válido com DDD na ordem de serviço.");
  }

  return <>
    <div className="mb-3 space-y-3">
      <div className="space-y-2">
        <Label htmlFor="quote-prepared-by">Orçamento preparado por</Label>
        <Input id="quote-prepared-by" value={preparedBy} onChange={(event) => setPreparedBy(event.target.value)} placeholder="Nome do responsável" maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="quote-validity">Validade do orçamento (dias)</Label>
        <Input id="quote-validity" type="number" min="1" max="90" value={options.validityDays} onChange={(event) => updateOption("validityDays", Math.min(90, Math.max(1, Number(event.target.value) || 1)))} />
        <p className="text-xs text-muted-foreground">O PDF calcula automaticamente a data limite a partir da emissão. Padrão: 7 dias.</p>
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={() => setShowDetails((value) => !value)}>
        {showDetails ? "Ocultar condições e observações" : "Adicionar condições de pagamento e serviço"}
      </Button>
      {showDetails && <div className="space-y-3 rounded-md border border-border p-3">
        <div className="space-y-2">
          <Label htmlFor="quote-payment-terms">Condições de pagamento</Label>
          <Textarea id="quote-payment-terms" value={options.paymentTerms} onChange={(event) => updateOption("paymentTerms", event.target.value)} rows={2} placeholder="Ex.: entrada de 50% e saldo na entrega." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote-payment-methods">Formas de pagamento</Label>
          <Input id="quote-payment-methods" value={options.paymentMethods} onChange={(event) => updateOption("paymentMethods", event.target.value)} placeholder="Informe apenas as formas aceitas pela oficina" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote-service-conditions">Condições do serviço</Label>
          <Textarea id="quote-service-conditions" value={options.serviceConditions} onChange={(event) => updateOption("serviceConditions", event.target.value)} rows={3} placeholder="Garantias, itens não inclusos, condições para início do serviço..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote-observations">Observações para o cliente</Label>
          <Textarea id="quote-observations" value={options.observations} onChange={(event) => updateOption("observations", event.target.value)} rows={3} placeholder="Informações adicionais que devem aparecer no orçamento." />
        </div>
      </div>}
      <p className="text-xs text-muted-foreground">Os campos comerciais acima são aplicados ao PDF gerado nesta tela; não alteram o cadastro da OS.</p>
    </div>
    {message != null && <Button type="button" className="h-11" disabled={!file} onClick={sendQuote}>{!file && !failed ? <Loader2 className="animate-spin" /> : <FileText />} Enviar orçamento pelo WhatsApp</Button>}
    <Button type="button" variant="outline" className="h-11" disabled={!file} onClick={shareWithCustomer}><Share2 /> Compartilhar PDF com o cliente</Button>
    <Button type="button" variant="outline" className="h-11" disabled={!file} onClick={() => { if (file) downloadQuote(file); }}>
      <Download /> {failed ? "PDF indisponível" : "Gerar novamente / baixar PDF atualizado"}
    </Button>
  </>;
}
