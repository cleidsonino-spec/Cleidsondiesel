import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { createQuotePdf, defaultQuotePdfOptions, type QuotePdfOptions } from "@/lib/quote-pdf";
import { canShareQuote, saveQuote, shareQuote } from "@/lib/quote-delivery";
import { waLink } from "@/lib/whatsapp";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];

export function QuotePdfActions({ order, message }: { order: Order; message?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [retryToken, setRetryToken] = useState(0);
  const [preparedBy, setPreparedBy] = useState("");
  const [options, setOptions] = useState<QuotePdfOptions>(defaultQuotePdfOptions);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparedKey, setPreparedKey] = useState("");
  const pdfKey = JSON.stringify([order, preparedBy, options, retryToken]);
  const readyFile = preparedKey === pdfKey ? file : null;

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
    setGenerating(true);
    const [snapshot, author, settings] = JSON.parse(pdfKey) as [Order, string, QuotePdfOptions];
    createQuotePdf(snapshot, author, settings).then((pdf) => {
      if (active) { setFile(pdf); setPreparedKey(pdfKey); }
    }).catch((error: unknown) => {
      if (active) {
        setFailed(true);
        console.error("Falha ao gerar PDF do orçamento:", error);
        toast.error(error instanceof Error ? `Falha ao gerar PDF: ${error.message}` : "Não foi possível gerar o PDF. Tente novamente.");
      }
    }).finally(() => {
      if (active) setGenerating(false);
    });
    return () => { active = false; };
  }, [pdfKey]);

  function updateOption<K extends keyof QuotePdfOptions>(key: K, value: QuotePdfOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  async function shareWithCustomer() {
    if (!readyFile || busy) return;
    setBusy(true);
    try {
      const text = [message ?? `Olá, ${order.customer_name}! Segue o orçamento da sua ordem de serviço.`, preparedBy ? `Orçamento preparado por: ${preparedBy}` : ""].filter(Boolean).join("\n\n");
      if (canShareQuote(readyFile)) {
        await shareQuote(readyFile, `Orçamento OS ${order.number} — Cleidson Diesel`, text);
      } else {
        await saveQuote(readyFile);
        toast.info("PDF baixado. Anexe o arquivo na conversa do cliente.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Falha ao compartilhar PDF:", error);
      toast.error("Não foi possível compartilhar. Use Baixar PDF atualizado e anexe o arquivo no WhatsApp.");
    } finally { setBusy(false); }
  }

  function sendQuote() {
    if (!readyFile || busy) return;
    if (canShareQuote(readyFile)) { void shareWithCustomer(); return; }
    const text = [message ?? "", preparedBy ? `Orçamento preparado por: ${preparedBy}` : ""].filter(Boolean).join("\n\n");
    const href = waLink(order.phone, text);
    if (!href) { toast.error("Falta um telefone válido com DDD na ordem de serviço."); return; }
    window.open(href, "_blank", "noopener,noreferrer");
    void saveQuote(readyFile).then(() => toast.info("PDF baixado. Anexe o arquivo na conversa do WhatsApp aberta.")).catch(() => toast.error("Não foi possível baixar o PDF. Tente Baixar PDF atualizado."));
  }

  async function download() {
    if (!readyFile) { setRetryToken((value) => value + 1); return; }
    setBusy(true);
    try { await saveQuote(readyFile); }
    catch { toast.error("Não foi possível baixar o PDF. Tente novamente."); }
    finally { setBusy(false); }
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
    {message != null && <Button type="button" className="min-h-11 h-auto whitespace-normal" disabled={!readyFile || busy} onClick={sendQuote}>{!readyFile && !failed ? <Loader2 className="animate-spin" /> : <FileText />} Enviar orçamento pelo WhatsApp</Button>}
    <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal" disabled={!readyFile || busy} onClick={shareWithCustomer}><Share2 /> Compartilhar PDF com o cliente</Button>
    <Button type="button" variant="outline" className="min-h-11 h-auto whitespace-normal" disabled={generating || busy} onClick={download}>
      {generating ? <Loader2 className="animate-spin" /> : <Download />}
      {generating ? "Preparando PDF..." : readyFile ? "Baixar PDF atualizado" : failed ? "Tentar gerar PDF novamente" : "Gerar PDF"}
    </Button>
  </>;
}
