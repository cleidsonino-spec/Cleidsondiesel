import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createQuotePdf, downloadQuote } from "@/lib/quote-pdf";
import { waLink } from "@/lib/whatsapp";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];

export function QuotePdfActions({ order, message }: { order: Order; message?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const metadata = user?.user_metadata ?? {};
      const name = [metadata.full_name, metadata.name, metadata.display_name].find((value) => typeof value === "string" && value.trim());
      if (active) setPreparedBy(typeof name === "string" ? name.trim() : user?.email?.split("@")[0] ?? "Equipe Cleidson Diesel");
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setFile(null); setFailed(false);
    createQuotePdf(order, preparedBy).then((pdf) => {
      if (!active) return;
      setFile(pdf); setCanShare(Boolean(navigator.canShare?.({ files: [pdf] })));
    }).catch(() => { if (active) { setFailed(true); toast.error("Não foi possível gerar o PDF. Reabra a ordem e tente novamente."); } });
    return () => { active = false; };
  }, [order, preparedBy]);
  async function share() {
    if (!file) return;
    try { await navigator.share({ files: [file], title: `Orçamento OS ${order.number} — Cleidson Diesel` }); }
    catch (error) { if (error instanceof Error && error.name === "AbortError") return; toast.error("Não foi possível compartilhar. Baixe o PDF e anexe no WhatsApp."); }
  }
  function sendQuote() {
    if (!file) return;
    downloadQuote(file);
    const text = [message ?? "", preparedBy ? `Orçamento preparado por: ${preparedBy}` : ""].filter(Boolean).join("\\n\\n");
    const href = waLink(order.phone, text);
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
      toast.success("Orçamento baixado e WhatsApp do cliente aberto. Anexe o PDF na conversa.");
    } else {
      toast.error("PDF baixado, mas falta um telefone válido com DDD na ordem de serviço.");
    }
  }

