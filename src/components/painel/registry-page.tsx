import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Car, Pencil, Plus, Search, Trash2, Users, Save, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { customersQuery, vehiclesQuery } from "@/lib/registry";
import { customerOrdersQuery } from "@/lib/queries";
import { warrantiesQuery, warrantyState } from "@/lib/warranty";
import { StatusBadge } from "@/components/site/status-badge";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { formatBRL, orderStatusInfo, orderTotal, ORDER_STATUSES } from "@/lib/status";
import { isValidPlate, normalizePlate, formatPlate } from "@/lib/plate";
import { isValidCpf, isValidCnpj, formatCpf, formatCnpj } from "@/lib/customer-identity";

type Draft = { id?: string; name: string; phone: string; email: string; address: string; notes: string; customer_type: string; document: string; customer_id: string; plate: string; model: string; year: string; mileage: string };
const blank: Draft = { name: "", phone: "", email: "", address: "", notes: "", customer_type: "pf", document: "", customer_id: "", plate: "", model: "", year: "", mileage: "" };

export function RegistryPage({ mode, readOnly = false, canDelete = true, includeWarranties = false }: { mode: "customers" | "vehicles"; readOnly?: boolean; canDelete?: boolean; includeWarranties?: boolean }) {
  const { data: customers } = useSuspenseQuery(customersQuery());
  const { data: vehicles } = useSuspenseQuery(vehiclesQuery());
  const { data: warranties = [] } = useQuery({ ...warrantiesQuery(), enabled: includeWarranties });
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<(typeof customers)[number] | null>(null);
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyPlate, setHistoryPlate] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const { data: historyOrders = [], isLoading: historyOrdersLoading, isError: historyOrdersError } = useQuery(customerOrdersQuery(historyCustomer?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const isCustomer = mode === "customers";
  const set = (key: keyof Draft, value: string) => setDraft((d) => d ? { ...d, [key]: value } : d);
  const matches = (text: string) => text.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (isCustomer ? (!draft.name.trim() || !draft.customer_type || !(draft.customer_type === "pf" ? isValidCpf(draft.document) : draft.customer_type === "pj" ? isValidCnpj(draft.document) : false)) : !draft.customer_id || !draft.model.trim() || !isValidPlate(draft.plate)) {
      toast.error(isCustomer ? "Informe o nome, tipo de pessoa e um CPF/CNPJ válido." : "Informe cliente, modelo e placa válida."); return;
    }
    setSaving(true);
    try {
      const result = isCustomer
        ? await (draft.id ? supabase.from("customers").update({ name: draft.name.trim(), customer_type: draft.customer_type, document: draft.document.replace(/\D/g, ""), phone: draft.phone.trim() || null, email: draft.email.trim() || null, address: draft.address.trim() || null, notes: draft.notes.trim() || null }).eq("id", draft.id) : supabase.from("customers").insert({ name: draft.name.trim(), customer_type: draft.customer_type, document: draft.document.replace(/\D/g, ""), phone: draft.phone.trim() || null, email: draft.email.trim() || null, address: draft.address.trim() || null, notes: draft.notes.trim() || null }))
        : await (draft.id ? supabase.from("vehicles").update({ customer_id: draft.customer_id, plate: normalizePlate(draft.plate), model: draft.model.trim(), year: draft.year.trim() || null, mileage: draft.mileage.trim() || null, notes: draft.notes.trim() || null }).eq("id", draft.id) : supabase.from("vehicles").insert({ customer_id: draft.customer_id, plate: normalizePlate(draft.plate), model: draft.model.trim(), year: draft.year.trim() || null, mileage: draft.mileage.trim() || null, notes: draft.notes.trim() || null }));
      if (result.error) { toast.error(result.error.code === "23505" ? (isCustomer ? "Este CPF/CNPJ já está cadastrado." : "Esta placa já está cadastrada.") : "Não foi possível salvar o cadastro."); return; }
      await qc.invalidateQueries({ queryKey: [mode] });
      await qc.invalidateQueries({ queryKey: ["lookup-vehicle"] });
      setDraft(null); toast.success("Cadastro salvo.");
    } finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir este cadastro?")) return;
    const { error } = await supabase.from(mode).delete().eq("id", id);
    if (error) { toast.error(error.code === "23503" ? "Este cadastro possui veículos ou ordens vinculadas e não pode ser excluído." : "Não foi possível excluir."); return; }
    await qc.invalidateQueries({ queryKey: [mode] }); toast.success("Cadastro excluído.");
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Cadastros da oficina</p><h1 className="text-3xl">{isCustomer ? "Clientes" : "Veículos"}</h1></div>{!readOnly && <Button onClick={() => setDraft({ ...blank })}><Plus />{isCustomer ? "Novo cliente" : "Novo veículo"}</Button>}</div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar cadastro" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isCustomer ? "Nome, telefone ou CPF/CNPJ" : "Placa, modelo ou cliente"} /></div>
    <div className="divide-y divide-border border-y border-border">
      {isCustomer ? customers.filter((c) => matches(`${c.name} ${c.phone ?? ""} ${c.document ?? ""}`)).map((c) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="flex items-center gap-2 font-semibold"><Users className="size-4 shrink-0 text-primary" />{c.name}</p><p className="text-sm text-muted-foreground">{c.phone || "Sem telefone"} · {vehicles.filter((v) => v.customer_id === c.id).length} veículo(s)</p>{c.document && <p className="text-sm text-muted-foreground">{c.customer_type === "pj" ? "CNPJ" : "CPF"}: {c.customer_type === "pj" ? formatCnpj(c.document) : formatCpf(c.document)}</p>}{c.email && <p className="break-all text-sm text-muted-foreground">{c.email}</p>}</div><div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => setHistoryCustomer(c)}><History className="mr-1 size-4" />Histórico</Button><Button asChild variant="outline" size="sm"><Link to="/painel/ordens/nova" search={{ cliente: c.id }}>Nova OS</Link></Button>{!readOnly && <Button variant="ghost" size="icon" aria-label={"Editar " + c.name} title="Editar cliente" onClick={() => setDraft({ ...blank, ...c, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", notes: c.notes ?? "", customer_type: c.customer_type ?? "", document: c.document ?? "" })}><Pencil /></Button>}{canDelete && <Button variant="ghost" size="icon" aria-label={"Excluir " + c.name} title="Excluir cliente" onClick={() => remove(c.id)}><Trash2 /></Button>}</div></div>)
      : vehicles.filter((v) => matches(`${v.plate} ${formatPlate(v.plate)} ${v.model} ${customers.find((c) => c.id === v.customer_id)?.name ?? ""}`)).map((v) => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="flex items-center gap-2 font-semibold"><Car className="size-4 text-primary" /><span className="plate">{formatPlate(v.plate)}</span></p><p>{v.model} {v.year && `· ${v.year}`}</p><p className="text-sm text-muted-foreground">{customers.find((c) => c.id === v.customer_id)?.name}</p></div><div className="flex items-center gap-1"><Button asChild variant="outline" size="sm"><Link to="/painel/ordens/nova" search={{ cliente: v.customer_id, veiculo: v.id }}>Nova OS</Link></Button>{!readOnly && <Button variant="ghost" size="icon" aria-label={"Editar " + v.plate} title="Editar veículo" onClick={() => setDraft({ ...blank, ...v, year: v.year ?? "", mileage: v.mileage ?? "", notes: v.notes ?? "" })}><Pencil /></Button>}{canDelete && <Button variant="ghost" size="icon" aria-label={"Excluir " + v.plate} title="Excluir veículo" onClick={() => remove(v.id)}><Trash2 /></Button>}</div></div>)}
    </div>
    {(isCustomer ? customers : vehicles).length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum {isCustomer ? "cliente" : "veículo"} cadastrado.</p>}
    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{draft?.id ? "Editar" : "Novo"} {isCustomer ? "cliente" : "veículo"}</DialogTitle></DialogHeader>{draft && <form onSubmit={save} className="space-y-4">
      {isCustomer ? <><Field label="Nome do cliente" id="registry-name"><Input id="registry-name" required value={draft.name} onChange={(e) => set("name", e.target.value)} /></Field><Field label="Tipo de pessoa" id="registry-customer-type"><Select value={draft.customer_type} onValueChange={(value) => { set("customer_type", value); set("document", ""); }}><SelectTrigger id="registry-customer-type"><SelectValue placeholder="Selecione PF ou PJ" /></SelectTrigger><SelectContent><SelectItem value="pf">Pessoa Física</SelectItem><SelectItem value="pj">Pessoa Jurídica</SelectItem></SelectContent></Select></Field><Field label={draft.customer_type === "pj" ? "CNPJ" : "CPF"} id="registry-document"><Input id="registry-document" required inputMode="numeric" value={draft.document} onChange={(e) => set("document", draft.customer_type === "pj" ? formatCnpj(e.target.value) : formatCpf(e.target.value))} placeholder={draft.customer_type === "pj" ? "00.000.000/0000-00" : "000.000.000-00"} /></Field><Field label="Telefone / WhatsApp" id="registry-phone"><Input id="registry-phone" type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} /></Field><Field label="Email" id="registry-email"><Input id="registry-email" type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} /></Field><Field label="Endereço" id="registry-address"><Input id="registry-address" value={draft.address} onChange={(e) => set("address", e.target.value)} /></Field></>
      : <><Field label="Cliente proprietário" id="registry-owner"><Select value={draft.customer_id} onValueChange={(value) => set("customer_id", value)}><SelectTrigger id="registry-owner"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Placa" id="registry-plate"><Input id="registry-plate" maxLength={8} required value={draft.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} /></Field><Field label="Modelo" id="registry-model"><Input id="registry-model" required value={draft.model} onChange={(e) => set("model", e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Ano" id="registry-year"><Input id="registry-year" value={draft.year} onChange={(e) => set("year", e.target.value)} /></Field><Field label="Quilometragem" id="registry-mileage"><Input id="registry-mileage" value={draft.mileage} onChange={(e) => set("mileage", e.target.value)} /></Field></div></>}
      <Field label="Observações" id="registry-notes"><Textarea id="registry-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} /></Field><Button type="submit" disabled={saving}><Save />{saving ? "Salvando…" : "Salvar cadastro"}</Button>
    </form>}</DialogContent></Dialog>
    <Dialog open={historyCustomer !== null} onOpenChange={(open) => { if (!open) setHistoryCustomer(null); }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Histórico do cliente</DialogTitle></DialogHeader>
        {historyCustomer && (() => {
          const normalizedPlateFilter = normalizePlate(historyPlate);
          const customerOrders = historyOrders.filter((order) => {
            if (historyStatus !== "all" && order.status !== historyStatus) return false;
            if (normalizedPlateFilter && !normalizePlate(order.plate).includes(normalizedPlateFilter)) return false;
            if (historyStartDate && order.entry_date < historyStartDate) return false;
            if (historyEndDate && order.entry_date > historyEndDate) return false;
            return true;
          });
          const customerOrderIds = new Set(customerOrders.map((order) => order.id));
          const customerWarranties = warranties.filter((warranty) => customerOrderIds.has(warranty.service_order_id));
          return <div className="space-y-6">
            <section className="rounded-md border border-border p-4">
              <h3 className="font-semibold">{historyCustomer.name}</h3>
              <p className="text-sm text-muted-foreground">{historyCustomer.customer_type === "pj" ? "Pessoa Jurídica" : historyCustomer.customer_type === "pf" ? "Pessoa Física" : "Tipo não informado"} · {historyCustomer.document || "Documento não informado"}</p>
              <p className="text-sm text-muted-foreground">{historyCustomer.phone || "Sem telefone"}{historyCustomer.email ? " · " + historyCustomer.email : ""}</p>
              {historyCustomer.address && <p className="text-sm text-muted-foreground">{historyCustomer.address}</p>}
            </section>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Ordens de Serviço</h3><span className="text-sm text-muted-foreground">{customerOrders.length} de {historyOrders.length} OS</span></div>
              <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="history-status">Status da OS</Label><Select value={historyStatus} onValueChange={setHistoryStatus}><SelectTrigger id="history-status"><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{ORDER_STATUSES.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="history-plate">Placa do veículo</Label><Input id="history-plate" value={historyPlate} onChange={(e) => setHistoryPlate(e.target.value.toUpperCase())} placeholder="Digite a placa" /></div>
                <div className="space-y-2"><Label htmlFor="history-start">Data inicial</Label><Input id="history-start" type="date" value={historyStartDate} max={historyEndDate || undefined} onChange={(e) => setHistoryStartDate(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="history-end">Data final</Label><Input id="history-end" type="date" value={historyEndDate} min={historyStartDate || undefined} onChange={(e) => setHistoryEndDate(e.target.value)} /></div>
                <div className="sm:col-span-2"><Button type="button" variant="outline" size="sm" onClick={() => { setHistoryStatus("all"); setHistoryPlate(""); setHistoryStartDate(""); setHistoryEndDate(""); }}>Limpar filtros</Button></div>
              </div>
              {historyOrdersLoading ? <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">Carregando ordens de serviço…</p> : historyOrdersError ? <p className="rounded-md border border-dashed p-5 text-center text-sm text-destructive">Não foi possível carregar o histórico de OS. Tente novamente.</p> : customerOrders.length === 0 ? <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhuma OS vinculada a este cadastro.</p> :
                <div className="divide-y rounded-md border border-border">
                  {customerOrders.map((order) => {
                    const info = orderStatusInfo(order.status);
                    return <Link key={order.id} to="/painel/ordens/$id" params={{ id: order.id }} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-secondary">
                      <div><p className="font-semibold">OS nº {order.number} · {formatPlate(order.plate)}</p><p className="text-sm text-muted-foreground">{order.vehicle} · {formatDateBR(order.entry_date)}</p><p className="text-sm text-muted-foreground">{formatBRL(orderTotal(order.parts_value, order.labor_value))}</p></div>
                      <StatusBadge tone={info.tone} label={info.label} />
                    </Link>;
                  })}
                </div>}
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-semibold">Garantias</h3><span className="text-sm text-muted-foreground">{customerWarranties.length} registro(s)</span></div>
              {customerWarranties.length === 0 ? <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhuma garantia vinculada às OS deste cliente.</p> :
                <div className="divide-y rounded-md border border-border">
                  {customerWarranties.map((warranty) => {
                    const order = customerOrders.find((item) => item.id === warranty.service_order_id);
                    return <Link key={warranty.id} to="/painel/garantias/$id" params={{ id: warranty.id }} className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-secondary">
                      <div><p className="font-semibold">Garantia · OS nº {order?.number ?? "—"}</p><p className="text-sm text-muted-foreground">{formatDateBR(warranty.start_date)} até {formatDateBR(warranty.end_date)} · {warranty.duration_months} meses</p></div>
                      <span className="text-sm">{warrantyState(warranty.start_date, warranty.end_date, todayISO())}</span>
                    </Link>;
                  })}
                </div>}
            </section>
            <p className="text-xs text-muted-foreground">O histórico considera as OS vinculadas ao cadastro do cliente. Registros antigos sem vínculo de cliente não aparecem nesta lista.</p>
          </div>;
        })()}
      </DialogContent>
    </Dialog>
  </div>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }