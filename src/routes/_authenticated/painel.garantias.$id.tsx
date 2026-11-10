import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-cleidson-diesel.png.asset.json";
import { warrantiesQuery, warrantyState } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { formatPlate } from "@/lib/plate";
export const Route = createFileRoute("/_authenticated/painel/garantias/$id")({
  head: () => ({ meta: [{ title: "Certificado de garantia — Cleidson Diesel" }, { name: "description", content: "Certificado de garantia de peças e serviços da Cleidson Diesel." }, { property: "og:title", content: "Certificado de garantia — Cleidson Diesel" }, { property: "og:description", content: "Identificação, cobertura e prazo de garantia." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(warrantiesQuery()),
  component: Certificate,
});
function Certificate() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(warrantiesQuery());
  const w = data.find((entry) => entry.id === id);
  if (!w) return <p>Garantia não encontrada.</p>;
  const o = w.service_orders;
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-3 print:hidden"><Button asChild variant="ghost"><Link to="/painel/garantias"><ArrowLeft />Garantias</Link></Button><Button onClick={() => window.print()}><Printer />Imprimir certificado</Button></div><article className="mx-auto max-w-3xl space-y-6"><div className="flex items-center gap-4 border-b-2 border-primary pb-5"><img src={logo.url} alt="Cleidson Diesel" className="size-16 rounded-full object-cover" /><div><p className="font-display text-2xl uppercase">Cleidson Diesel</p><p className="text-sm text-muted-foreground">Bomba injetora e injeção diesel</p><p className="text-sm">WhatsApp: (71) 98657-1661</p></div></div><div><h1 className="text-2xl">Certificado de garantia</h1><p className="mt-2 text-sm text-muted-foreground">OS nº {o?.number} · {warrantyState(w.start_date, w.end_date, todayISO())}</p></div><div className="grid gap-3 sm:grid-cols-2"><p><strong>Cliente:</strong> {o?.customer_name}</p><p><strong>Telefone:</strong> {o?.phone || "—"}</p><p><strong>Veículo:</strong> {o?.vehicle} {o?.vehicle_year}</p><p><strong>Placa:</strong> {formatPlate(o?.plate ?? "")}</p><p><strong>Início:</strong> {formatDateBR(w.start_date)}</p><p><strong>Vencimento:</strong> {formatDateBR(w.end_date)}</p><p><strong>Prazo:</strong> {w.duration_months} meses</p></div><section className="border-t border-border pt-4"><h2 className="text-base">Peças e serviços cobertos</h2><p className="mt-2 whitespace-pre-wrap">{w.coverage || "Não informado"}</p></section><section className="border-t border-border pt-4"><h2 className="text-base">Condições e observações</h2><p className="mt-2 whitespace-pre-wrap">{w.terms || "Não informado"}</p></section><div className="grid grid-cols-2 gap-8 pt-16 text-center text-sm"><p className="border-t border-foreground pt-2">Cliente</p><p className="border-t border-foreground pt-2">Cleidson Diesel</p></div></article></div>;
}