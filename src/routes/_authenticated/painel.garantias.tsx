import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, ShieldCheck, Clock3, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { warrantiesQuery, warrantyState } from "@/lib/warranty";
import { customersQuery } from "@/lib/registry";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { formatPlate, normalizePlate } from "@/lib/plate";

export const Route = createFileRoute("/_authenticated/painel/garantias")({ component: () => <Outlet /> });

function daysUntil(date: string, today: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round((Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) - Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1)) / 86400000);
}

export function WarrantyList() {
  const { data } = useSuspenseQuery(warrantiesQuery());
  const { data: customers } = useSuspenseQuery(customersQuery());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todas");
  const today = todayISO();
  const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const rows = data.map((w) => {
    const state = warrantyState(w.start_date, w.end_date, today);
    const remainingDays = daysUntil(w.end_date, today);
    const customer = customerById.get(w.service_orders?.customer_id ?? "");
    return { warranty: w, state, remainingDays, customer };
  });
  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.state === "Vigente").length,
    expired: rows.filter((r) => r.state === "Vencida").length,
    starting: rows.filter((r) => r.state === "A iniciar").length,
    expiring: rows.filter((r) => r.state === "Vigente" && r.remainingDays >= 0 && r.remainingDays <= 30).length,
  };
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const normalizedDocument = search.replace(/\D/g, "");
  const filtered = rows.filter(({ warranty: w, state, remainingDays, customer }) => {
    const matchesStatus = status === "Todas"
      || (status === "Vencendo em 30 dias" ? state === "Vigente" && remainingDays >= 0 && remainingDays <= 30 : state === status);
    const searchable = `${w.service_orders?.customer_name ?? ""} ${w.service_orders?.phone ?? ""} ${w.service_orders?.plate ?? ""} ${formatPlate(w.service_orders?.plate ?? "")} ${normalizePlate(w.service_orders?.plate ?? "")} ${w.service_orders?.number ?? ""} ${customer?.document ?? ""} ${customer?.name ?? ""}`.toLocaleLowerCase("pt-BR");
    const matchesText = searchable.includes(normalizedSearch) || (normalizedDocument.length > 0 && (customer?.document ?? "").includes(normalizedDocument));
    return matchesStatus && matchesText;
  });

  return <div className="space-y-6">
    <div><p className="text-sm text-muted-foreground">Pós-serviço</p><h1 className="flex items-center gap-2 text-3xl"><ShieldCheck className="text-primary" />Garantias</h1></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <SummaryCard title="Total" value={counts.all} icon={<ShieldCheck className="size-5 text-muted-foreground" />} />
      <SummaryCard title="Vigentes" value={counts.active} icon={<CheckCircle2 className="size-5 text-muted-foreground" />} />
      <SummaryCard title="Vencendo em 30 dias" value={counts.expiring} icon={<Clock3 className="size-5 text-muted-foreground" />} />
      <SummaryCard title="Vencidas" value={counts.expired} icon={<AlertTriangle className="size-5 text-muted-foreground" />} />
      <SummaryCard title="A iniciar" value={counts.starting} icon={<Clock3 className="size-5 text-muted-foreground" />} />
    </div>
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="space-y-2"><Label htmlFor="warranty-search">Buscar garantia</Label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="warranty-search" className="pl-9" aria-label="Buscar garantia" placeholder="Cliente, CPF/CNPJ, telefone, placa ou número da OS" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
      <div className="space-y-2"><Label htmlFor="warranty-status">Situação</Label><Select value={status} onValueChange={setStatus}><SelectTrigger id="warranty-status"><SelectValue placeholder="Todas as garantias" /></SelectTrigger><SelectContent>{["Todas", "Vigente", "Vencendo em 30 dias", "Vencida", "A iniciar"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{filtered.length} de {data.length} garantia(s)</p>{(search || status !== "Todas") && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus("Todas"); }}>Limpar filtros</Button>}</div>
    <div className="divide-y divide-border border-y border-border">
      {filtered.map(({ warranty: w, state, remainingDays }) => <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><p className="font-semibold">OS nº {w.service_orders?.number} · {w.service_orders?.customer_name}</p><p className="text-sm">{formatPlate(w.service_orders?.plate ?? "")} · {w.service_orders?.vehicle}</p><p className="text-sm text-muted-foreground">{state} · {w.duration_months} meses · até {formatDateBR(w.end_date)}</p>{state === "Vigente" && remainingDays <= 30 && <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{remainingDays === 0 ? "Vence hoje" : `Vence em ${remainingDays} dia(s)`}</p>}</div>
        <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to="/painel/garantias/$id" params={{ id: w.id }}>Certificado</Link></Button><Button asChild variant="ghost" size="sm"><Link to="/painel/ordens/$id" params={{ id: w.service_order_id }}>Ver OS</Link></Button></div>
      </div>)}
    </div>
    {filtered.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma garantia encontrada.</p>}
  </div>;
}

function SummaryCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"><div><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-semibold tabular-nums">{value}</p></div>{icon}</div>;
}
