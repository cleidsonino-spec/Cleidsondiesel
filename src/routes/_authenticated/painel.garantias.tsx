import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { warrantiesQuery, warrantyState } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { formatPlate } from "@/lib/plate";

export const Route = createFileRoute("/_authenticated/painel/garantias")({ component: () => <Outlet /> });
export function WarrantyList() {
  const { data } = useSuspenseQuery(warrantiesQuery());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todas");
  const filtered = data.filter((w) => (status === "Todas" || warrantyState(w.start_date, w.end_date, todayISO()) === status) && `${w.service_orders?.customer_name} ${w.service_orders?.plate} ${formatPlate(w.service_orders?.plate ?? "")} ${w.service_orders?.number}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Pós-serviço</p><h1 className="flex items-center gap-2 text-3xl"><ShieldCheck className="text-primary" />Garantias</h1></div><div className="flex flex-wrap items-center gap-3"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar garantia" placeholder="Cliente, placa ou número da OS" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="flex flex-wrap gap-1">{["Todas", "Vigente", "Vencida", "A iniciar"].map((s) => <Button key={s} variant={status === s ? "secondary" : "ghost"} size="sm" onClick={() => setStatus(s)}>{s}</Button>)}</div></div><div className="divide-y divide-border border-y border-border">{filtered.map((w) => <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">OS nº {w.service_orders?.number} · {w.service_orders?.customer_name}</p><p className="text-sm">{formatPlate(w.service_orders?.plate ?? "")} · {w.service_orders?.vehicle}</p><p className="text-sm text-muted-foreground">{warrantyState(w.start_date, w.end_date, todayISO())} · {w.duration_months} meses · até {formatDateBR(w.end_date)}</p></div><div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to="/painel/garantias/$id" params={{ id: w.id }}>Certificado</Link></Button><Button asChild variant="ghost" size="sm"><Link to="/painel/ordens/$id" params={{ id: w.service_order_id }}>Ver OS</Link></Button></div></div>)}</div>{filtered.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma garantia encontrada.</p>}</div>;
}