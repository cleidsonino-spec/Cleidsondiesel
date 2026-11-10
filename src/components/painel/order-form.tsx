import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { formatBRL, ORDER_STATUSES, orderTotal, type OrderStatus } from "@/lib/status";
import { draftPartItems, lineTotal, parseMoney, parseQuantity, partsTotal, type PartDraft } from "@/lib/parts";
import { InspectionDiagnosisAction } from "@/components/painel/inspection-diagnosis";
import { writeInspectionData, type InspectionData } from "@/lib/inspection";
import { useQuery } from "@tanstack/react-query";
import { customersQuery, vehiclesQuery } from "@/lib/registry";
export { parseMoney } from "@/lib/parts";

export type OrderInput = Database["public"]["Tables"]["service_orders"]["Insert"];

export type OrderFormValues = {
  customer_id?: string;
  vehicle_id?: string;
  plate: string;
  customer_name: string;
  phone: string;
  vehicle: string;
  vehicle_year: string;
  mileage: string;
  complaint: string;
  diagnosis: string;
  parts: string;
  part_items: PartDraft[];
  labor_value: string;
  status: OrderStatus;
  entry_date: string;
  due_date: string;
  notes: string;
  inspection: InspectionData;
};

export function toOrderInput(v: OrderFormValues): OrderInput {
  return {
    customer_id: v.customer_id || null,
    vehicle_id: v.vehicle_id || null,
    plate: normalizePlate(v.plate),
    customer_name: v.customer_name.trim(),
    phone: v.phone.trim() || null,
    vehicle: v.vehicle.trim(),
    vehicle_year: v.vehicle_year.trim() || null,
    mileage: v.mileage.trim() || null,
    complaint: v.complaint.trim(),
    diagnosis: v.diagnosis.trim() || null,
    parts: v.parts.trim() || null,
    part_items: draftPartItems(v.part_items),
    parts_value: partsTotal(draftPartItems(v.part_items)),
    labor_value: parseMoney(v.labor_value),
    status: v.status,
    entry_date: v.entry_date,
    due_date: v.due_date || null,
    notes: v.notes.trim() || null,
    inspection_checklist: writeInspectionData(v.inspection),
  };
}

export function OrderForm({
  initial,
  onSubmit,
  submitLabel,
  extraActions,
}: {
  initial: OrderFormValues;
  onSubmit: (v: OrderInput) => Promise<void>;
  submitLabel: string;
  extraActions?: ReactNode;
}) {
  const [v, setV] = useState<OrderFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const { data: customers = [] } = useQuery(customersQuery());
  const { data: vehicles = [] } = useQuery(vehiclesQuery());
  const chooseCustomer = (id: string) => {
    const c = customers.find((item) => item.id === id);
    setV((p) => ({ ...p, customer_id: c?.id ?? "", vehicle_id: "", ...(c ? { customer_name: c.name, phone: c.phone ?? "" } : {}) }));
  };
  const chooseVehicle = (id: string) => {
    const vehicle = vehicles.find((item) => item.id === id);
    const customer = customers.find((item) => item.id === vehicle?.customer_id);
    setV((p) => ({ ...p, vehicle_id: vehicle?.id ?? "", ...(vehicle ? { plate: vehicle.plate, vehicle: vehicle.model, vehicle_year: vehicle.year ?? "", mileage: vehicle.mileage ?? "", customer_id: vehicle.customer_id, customer_name: customer?.name ?? p.customer_name, phone: customer?.phone ?? "" } : {}) }));
  };
  const set = <K extends keyof OrderFormValues>(k: K, val: OrderFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (!isValidPlate(v.plate)) { toast.error("Placa inválida. Ex: ABC1234 ou ABC1D23."); return; }
    if (!v.customer_name.trim()) { toast.error("Informe o nome do cliente."); return; }
    if (!v.vehicle.trim()) { toast.error("Informe o veículo."); return; }
    if (!v.complaint.trim()) { toast.error("Descreva o serviço / reclamação."); return; }
    if (draftPartItems(v.part_items).some((item) => !item.description || item.quantity <= 0)) { toast.error("Informe a descrição e uma quantidade válida para cada peça."); return; }
    setSaving(true);
    try { await onSubmit(toOrderInput(v)); }
    finally { setSaving(false); }
  }

  const piecesTotal = partsTotal(draftPartItems(v.part_items));
  const total = orderTotal(piecesTotal, parseMoney(v.labor_value));
  const updatePart = (index: number, key: keyof PartDraft, value: string) =>
    set("part_items", v.part_items.map((item, i) => i === index ? { ...item, [key]: value } : item));

  return (
    <form onSubmit={handle} className="space-y-6">
      <Section title="Cliente e veículo">
        <F label="Cliente cadastrado"><Select value={v.customer_id || "manual"} onValueChange={(id) => chooseCustomer(id === "manual" ? "" : id)}><SelectTrigger aria-label="Cliente cadastrado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Sem vínculo ao cadastro</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></F>
        <F label="Veículo cadastrado"><Select value={v.vehicle_id || "manual"} onValueChange={(id) => chooseVehicle(id === "manual" ? "" : id)}><SelectTrigger aria-label="Veículo cadastrado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Sem vínculo ao cadastro</SelectItem>{vehicles.filter((vehicle) => !v.customer_id || vehicle.customer_id === v.customer_id).map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.model}</SelectItem>)}</SelectContent></Select></F>
        <F label="Placa"><Input value={v.plate} onChange={(e) => { const plate = e.target.value.toUpperCase(); const found = vehicles.find((vehicle) => vehicle.plate === normalizePlate(plate)); if (found) chooseVehicle(found.id); else setV((p) => ({ ...p, plate, vehicle_id: "" })); }} maxLength={8} className="plate" placeholder="ABC1D23" /></F>
        <F label="Cliente"><Input value={v.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></F>
        <F label="WhatsApp / telefone"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} type="tel" placeholder="(00) 00000-0000" /></F>
        <F label="Veículo"><Input value={v.vehicle} onChange={(e) => set("vehicle", e.target.value)} placeholder="Ex: Hilux 3.0" /></F>
        <F label="Ano"><Input value={v.vehicle_year} onChange={(e) => set("vehicle_year", e.target.value)} /></F>
        <F label="Km"><Input value={v.mileage} onChange={(e) => set("mileage", e.target.value)} inputMode="numeric" /></F>
      </Section>

      <Section title="Serviço">
        <F label="Reclamação / serviço solicitado" wide><Textarea value={v.complaint} onChange={(e) => set("complaint", e.target.value)} rows={2} /></F>
        <F label="Diagnóstico para o cliente" wide><Textarea value={v.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} rows={4} placeholder="Descreva o diagnóstico ou gere uma sugestão com IA abaixo." /></F>
        <F label="Peças e serviços executados" wide><Textarea value={v.parts} onChange={(e) => set("parts", e.target.value)} rows={3} placeholder="Ex: kit reparo bomba, 4 bicos, calibração..." /></F>
      </Section>

      <Section title="Inspeção do mecânico">
        <F label="Itens reprovados" wide>
          <Textarea value={v.inspection.failedItems} onChange={(e) => set("inspection", { ...v.inspection, failedItems: e.target.value })} rows={4} placeholder={"Informe apenas os itens que foram reprovados.\nEx.: Bico injetor 2 — retorno acima do especificado."} />
        </F>
        <F label="Observações da inspeção" wide>
          <Textarea value={v.inspection.observations} onChange={(e) => set("inspection", { ...v.inspection, observations: e.target.value })} rows={4} placeholder="Descreva testes realizados, sintomas, medições e outras observações técnicas." />
        </F>
      </Section>
      <InspectionDiagnosisAction vehicle={v.vehicle} year={v.vehicle_year} complaint={v.complaint} failedItems={v.inspection.failedItems} observations={v.inspection.observations} onApply={(text) => {
        if (v.diagnosis.trim() && !window.confirm("Substituir o diagnóstico atual pela sugestão da IA?")) return;
        set("diagnosis", text);
      }} />

      <Section title="Peças e valores">
        <div className="space-y-3 sm:col-span-2 lg:col-span-3">
          {v.part_items.map((item, index) => (
            <div key={index} className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(85px,0.7fr)_minmax(110px,1fr)_minmax(110px,1fr)_40px] sm:items-end">
              <div className="col-span-2 space-y-2 sm:col-span-1"><Label htmlFor={"part-" + index}>Peça {index + 1}</Label><Input id={"part-" + index} value={item.description} onChange={(e) => updatePart(index, "description", e.target.value)} placeholder="Nome da peça" /></div>
              <div className="space-y-2"><Label htmlFor={"part-qty-" + index}>Quantidade</Label><Input id={"part-qty-" + index} type="number" min="1" step="1" inputMode="numeric" value={item.quantity} onChange={(e) => updatePart(index, "quantity", e.target.value)} placeholder="1" /></div>
              <div className="space-y-2"><Label htmlFor={"part-unit-" + index}>Valor unitário (R$)</Label><Input id={"part-unit-" + index} inputMode="decimal" value={item.unit_value} onChange={(e) => updatePart(index, "unit_value", e.target.value)} placeholder="0,00" /></div>
              <div className="space-y-2"><Label>Total da peça</Label><div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-semibold">{formatBRL(lineTotal(parseQuantity(item.quantity), parseMoney(item.unit_value)))}</div></div>
              <Button type="button" variant="ghost" size="icon" className="col-span-2 sm:col-span-1" aria-label={"Remover peça " + (index + 1)} title="Remover peça" onClick={() => set("part_items", v.part_items.filter((_, i) => i !== index))}><Trash2 className="text-destructive" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => set("part_items", [...v.part_items, { description: "", quantity: "1", unit_value: "" }])}><Plus /> Adicionar peça</Button>
            <p className="text-sm">Total das peças: <strong className="text-primary">{formatBRL(piecesTotal)}</strong></p>
          </div>
        </div>
      </Section>

      <Section title="Valores e prazos">
        <F label="Mão de obra (R$)"><Input value={v.labor_value} onChange={(e) => set("labor_value", e.target.value)} inputMode="decimal" placeholder="0,00" /></F>
        <div className="flex flex-col justify-end rounded-sm border border-primary/40 bg-primary/10 px-4 py-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span><span className="font-display text-2xl">{formatBRL(total)}</span>
        </div>
        <F label="Status">
          <Select value={v.status} onValueChange={(s) => set("status", s as OrderStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ORDER_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
        </F>
        <F label="Data de entrada"><Input type="date" value={v.entry_date} onChange={(e) => set("entry_date", e.target.value)} /></F>
        <F label="Previsão de entrega"><Input type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} /></F>
        <F label="Observações internas" wide><Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></F>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" disabled={saving} className="h-12">{saving ? <Loader2 className="animate-spin" /> : <Save />}{submitLabel}</Button>
        {extraActions}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-2 font-display text-sm uppercase text-primary">{title}</legend>{children}</fieldset>;
}
function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "space-y-2 sm:col-span-2 lg:col-span-3" : "space-y-2"}><Label>{label}</Label>{children}</div>;
}
