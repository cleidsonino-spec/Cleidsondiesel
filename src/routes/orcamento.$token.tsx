import { useState } from "react";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/site/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { readApproval } from "@/lib/approval.functions";
import { readPartItems } from "@/lib/parts";
import { formatBRL, orderTotal } from "@/lib/status";
import { formatPlate } from "@/lib/plate";
import { formatCpf, isFullName, isValidCpf } from "@/lib/customer-identity";
import { approvalShopLink } from "@/lib/whatsapp";

type Quote = { number: number; customer_name: string; plate: string; vehicle: string; complaint: string; diagnosis: string | null; parts: string | null; part_items: unknown; parts_value: number; labor_value: number };
type Result = { quote: Quote; state: string; approved_at: string | null; approved_by: string | null };
const options = (token: string) => queryOptions({ queryKey: ["public-approval", token], queryFn: async () => {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return await readApproval({ data: { token } }) as Result | null;
}, staleTime: 0 });

export const Route = createFileRoute("/orcamento/$token")({
  head: () => ({ meta: [
    { title: "Aprovar orçamento — Cleidson Diesel" },
    { name: "description", content: "Confira e autorize seu orçamento da Cleidson Diesel." },
    { property: "og:title", content: "Orçamento — Cleidson Diesel" },
    { property: "og:description", content: "Confira seu orçamento e confirme a autorização do serviço." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow, noarchive" }, { name: "referrer", content: "no-referrer" },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(options(params.token)),
  component: QuotePage,
});

function QuotePage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(options(token));
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  async function approve() {
    if (!accepted || !isFullName(name) || !isValidCpf(cpf)) return;
    setBusy(true);
    const { error } = await supabase.rpc("approve_quote_identified", { _token: token, _name: name.trim().replace(/\s+/g, " "), _cpf: cpf });
    setBusy(false);
    if (error) {
      const message = error.message.includes("Invalid name or CPF")
        ? "Confira o nome completo e o CPF informado."
        : error.message.includes("Quote unavailable")
          ? "Este orçamento foi alterado, vencido ou já não está disponível. Solicite um novo link à oficina."
          : "Não foi possível registrar a aprovação. Tente novamente ou entre em contato com a oficina.";
      toast.error(message);
      await qc.invalidateQueries({ queryKey: ["public-approval", token] });
      return;
    }
    setConfirmed(true);
    const whatsapp = data?.quote ? approvalShopLink(data.quote, name.trim()) : null;
    void qc.invalidateQueries({ queryKey: ["public-approval", token] });
    if (whatsapp) window.location.assign(whatsapp);
  }
  async function reject() {
    if (!isFullName(name) || !isValidCpf(cpf)) { toast.error("Informe nome completo e CPF válido para recusar."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("reject_quote_identified", { _token: token, _name: name.trim(), _cpf: cpf });
    setBusy(false);
    if (error) toast.error("O orçamento pode ter sido alterado ou vencido. Solicite um novo link à oficina.");
    await qc.invalidateQueries({ queryKey: ["public-approval", token] });
  }
  const o = data?.quote;
  return <PublicLayout><section className="mx-auto max-w-3xl px-4 py-12">
    <h1 className="text-3xl">Orçamento Cleidson Diesel</h1>
    {!o ? <p className="mt-6 text-muted-foreground">Link inválido, vencido ou orçamento alterado. Solicite um novo link à oficina.</p> : <div className="mt-6 space-y-6">
      <div className="space-y-2 border-y border-border py-5"><p>OS nº {o.number} · {o.customer_name}</p><p>{o.vehicle} · {formatPlate(o.plate)}</p></div>
      <div><h2 className="text-base">Serviço solicitado</h2><p className="mt-2 whitespace-pre-wrap break-words">{o.complaint}</p></div>
      {o.diagnosis && <div><h2 className="text-base">Diagnóstico</h2><p className="mt-2 whitespace-pre-wrap break-words">{o.diagnosis}</p></div>}
      {o.parts && <p className="whitespace-pre-wrap break-words">{o.parts}</p>}
      <table className="w-full table-fixed text-left"><thead><tr className="border-b border-border"><th className="w-2/3 py-3">Peças</th><th className="py-3 text-right">Valor</th></tr></thead><tbody>{readPartItems(o.part_items).map((p, i) => <tr key={i} className="border-b border-border"><td className="break-words py-3 pr-3">{p.description}</td><td className="text-right">{formatBRL(p.value)}</td></tr>)}</tbody></table>
      <div className="space-y-2"><p className="flex justify-between">Peças <strong>{formatBRL(Number(o.parts_value))}</strong></p><p className="flex justify-between">Mão de obra <strong>{formatBRL(Number(o.labor_value))}</strong></p><p className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xl font-bold">Total <span>{formatBRL(orderTotal(o.parts_value, o.labor_value))}</span></p></div>
      {data.state === "rejected" ? <p role="status" className="flex items-center gap-2 text-destructive"><X /> Orçamento recusado. A oficina foi avisada.</p> : data.state === "approved" || confirmed ? <div className="space-y-4"><p role="status" className="flex items-center gap-2 text-success"><Check /> Orçamento aprovado{data.approved_by ? ` por ${data.approved_by}` : ""}.</p><Button asChild><a href={approvalShopLink(o, data.approved_by || name || o.customer_name) ?? undefined} rel="noreferrer"><MessageCircle /> Falar no WhatsApp</a></Button></div> : <form className="space-y-4 border-t border-border pt-6" onSubmit={(e) => { e.preventDefault(); void approve(); }}>
        <Label htmlFor="approver">Seu nome completo</Label><Input id="approver" autoComplete="name" maxLength={120} minLength={2} required value={name} onChange={(e) => setName(e.target.value)} />
        {name && !isFullName(name) && <p className="text-sm text-destructive">Informe nome e sobrenome completos.</p>}
        <Label htmlFor="approver-cpf">CPF do cliente</Label><Input id="approver-cpf" inputMode="numeric" maxLength={14} required value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" aria-invalid={Boolean(cpf && !isValidCpf(cpf))} />
        {cpf && !isValidCpf(cpf) && <p className="text-sm text-destructive">Informe um CPF válido.</p>}
        <div className="flex items-start gap-3"><Checkbox id="authorize" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} /><Label htmlFor="authorize" className="leading-6">Li o orçamento e autorizo o serviço pelo total de {formatBRL(orderTotal(o.parts_value, o.labor_value))}.</Label></div>
        <Button type="submit" size="lg" disabled={busy || !accepted || !isFullName(name) || !isValidCpf(cpf)}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Aprovar orçamento</Button>
        <Button type="button" variant="outline" size="lg" className="ml-2" disabled={busy || !isFullName(name) || !isValidCpf(cpf)} onClick={() => void reject()}><X /> Recusar orçamento</Button>
      </form>}
    </div>}
  </section></PublicLayout>;
}