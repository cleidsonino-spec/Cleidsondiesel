import { useEffect, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createQuotePdf, downloadQuote } from "@/lib/quote-pdf";
import type { Database } from "@/integrations/supabase/types";

export function QuotePdfActions({ order }: { order: Database["public"]["Tables"]["service_orders"]["Row"] }) {
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
  return <>
    <Button type="button" variant="outline" className="h-11" disabled={!file} onClick={() => { if (file) downloadQuote(file); }}>
      {!file && !failed ? <Loader2 className="animate-spin" /> : <Download />} {failed ? "PDF indisponível" : "Baixar orçamento PDF"}
    </Button>
    {canShare && <Button type="button" variant="outline" className="h-11" disabled={!file} onClick={share}><Share2 /> Compartilhar PDF</Button>}
  </>;
}