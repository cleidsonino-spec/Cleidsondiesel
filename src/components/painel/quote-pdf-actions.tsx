import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createQuotePdf, downloadQuote } from "@/lib/quote-pdf";
import { waLink } from "@/lib/whatsapp";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];

export function QuotePdfActions({ order, message }: { order: Order; message?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    let active = true;
    setFile(null); setFailed(false);
    createQuotePdf(order).then((pdf) => {
      if (!active) return;
      setFile(pdf); setCanShare(Boolean(navigator.canShare?.({ files: [pdf] })));
    }).catch(() => { if (active) { setFailed(true); toast.error("Não foi possível gerar o PDF. Reabra a ordem e tente novamente."); } });
    return () => { active = false; };
  }, [order]);
  async function share() {
    if (!file) return;
    try { await navigator.share({ files: [file], title: `Orçamento OS ${order.number} — Cleidson Diesel` }); }
    catch (error) { if (error instanceof Error && error.name === "AbortError") return; toast.error("Não foi possível compartilhar. Baixe o PDF e anexe no WhatsApp."); }
  }
  async function sendQuote() {
    if (!file) return;
    const text = message ?? "";
    if (canShare) {
      try {
        await navigator.share({ files: [file], text, title: `Orçamento OS ${order.number} — Cleidson Diesel` });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    downloadQuote(file);
    const href = waLink(order.phone, text);
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
      toast.message("PDF baixado. Anexe o arquivo na conversa do WhatsApp que abriu.");
    } else {
      toast.message("PDF baixado. Cadastre o telefone do cliente para abrir a conversa do WhatsApp.");
    }
  }
  return <>
    {message != null && <Button type="button" className="h-11" disabled={!file} onClick={sendQuote}>
      {!file && !failed ? <Loader2 className="animate-spin" /> : <FileText />} Enviar orçamento
    </Button>}
    <Button type="button" variant="outline" className="h-11" disabled={!file} onClick={() => { if (file) downloadQuote(file); }}>
      <Download /> {failed ? "PDF indisponível" : "Baixar PDF"}
    </Button>
    {canShare && <Button type="button" variant="outline" className="h-11" disabled={!file} onClick={share}><Share2 /> Compartilhar PDF</Button>}
  </>;
}
