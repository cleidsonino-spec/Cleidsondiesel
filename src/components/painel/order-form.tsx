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
import { draftPartItems, parseMoney, partsTotal, type PartDraft } from "@/lib/parts";
import { InspectionChecklist } from "@/components/painel/inspection-checklist";
import type { InspectionItem } from "@/lib/inspection";
import { InspectionDiagnosisAction } from "@/components/painel/inspection-diagnosis";
export { parseMoney } from "@/lib/parts";

export type OrderInput = Database["public"]["Tables"]["service_orders"]["Insert"];

export type OrderFormValues = {
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
  inspection_checklist: InspectionItem[];
};

export function toOrderInput(v: OrderFormValues): OrderInput {
  return {
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
    inspection_checklist: v.inspection_checklist.map((item) => ({ ...item, label: item.label.trim(), notes: item.notes.trim() })),
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
  const set = <K extends keyof OrderFormValues>(k: K, val: OrderFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (!isValidPlate(v.plate)) { toast.error("Placa inválida. Ex: ABC1234 ou ABC1D23."); return; }
    if (!v.customer_name.trim()) { toast.error("Informe o nome do cliente."); return; }
    if (!v.vehicle.trim()) { toast.error("Informe o veículo."); return; }
    if (!v.complaint.trim()) { toast.error("Descreva o serviço / reclamação."); return; }
    if (draftPartItems(v.part_items).some((item) => !item.description)) { toast.error("Informe o nome de cada peça com valor."); return; }
    if (v.inspection_checklist.some((item) => !item.label.trim())) { toast.error("Informe o nome de cada item de inspeção."); return; }
    setSaving(true);
    try {
      await onSubmit(toOrderInput(v));
    } finally {
      setSaving(false);
    }
  }

  const piecesTotal = partsTotal(draftPartItems(v.part_items));
  const total = orderTotal(piecesTotal, parseMoney(v.labor_value));
  const updatePart = (index: number, key: keyof PartDraft, value: string) => set("part_items", v.part_items.map((item, i) => i === index ? { ...item, [key]: value } : item));

  return (
    <form onSubmit={handle} className="space-y-6">
      <Section title="Cliente e veículo">
        <F label="Placa">
          <Input value={v.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} maxLength={8} className="plate" placeholder="ABC1D23" />
        </F>
        <F label="Cliente">
          <Input value={v.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
        </F>
        <F label="WhatsApp / telefone">
          <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} type="tel" placeholder="(00) 00000-0000" />
        </F>
        <F label="Veículo">
          <Input value={v.vehicle} onChange={(e) => set("vehicle", e.target.value)} placeholder="Ex: Hilux 3.0" />
        </F>
        <F label="Ano">
          <Input value={v.vehicle_year} onChange={(e) => set("vehicle_year", e.target.value)} />
        </F>
        <F label="Km">
          <Input value={v.mileage} onChange={(e) => set("mileage", e.target.value)} inputMode="numeric" />
        </F>
      </Section>

      <Section title="Serviço">
        <F label="Reclamação / serviço solicitado" wide>
          <Textarea value={v.complaint} onChange={(e) => set("complaint", e.target.value)} rows={2} />
        </F>
        <F label="Diagnóstico" wide>
          <Textarea value={v.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} rows={3} />
        </F>
        <F label="Peças e serviços executados" wide>
          <Textarea value={v.parts} onChange={(e) => set("parts", e.target.value)} rows={3} placeholder="Ex: kit reparo bomba, 4 bicos, calibração..." />
        </F>
      </Section>

      <InspectionChecklist items={v.inspection_checklist} onChange={(items) => set("inspection_checklist", items)} />
      <InspectionDiagnosisAction vehicle={v.vehicle} year={v.vehicle_year} complaint={v.complaint} items={v.inspection_checklist} onApply={(text) => {
        if (v.diagnosis.trim() && !window.confirm("Substituir o diagnóstico atual pela sugestão revisada?")) return;
        set("diagnosis", text);
      }} />

      <Section title="Peças e valores">
        <div className="space-y-3 sm:col-span-2 lg:col-span-3">
          {v.part_items.map((item, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(90px,130px)_40px] items-end gap-2">
              <div className="space-y-2"><Label htmlFor={`part-${index}`}>Peça {index + 1}</Label><Input id={`part-${index}`} value={item.description} onChange={(e) => updatePart(index, "description", e.target.value)} placeholder="Nome da peça" /></div>
              <div className="space-y-2"><Label htmlFor={`part-value-${index}`}>Valor (R$)</Label><Input id={`part-value-${index}`} inputMode="decimal" value={item.value} onChange={(e) => updatePart(index, "value", e.target.value)} placeholder="0,00" /></div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover peça ${index + 1}`} title="Remover peça" onClick={() => set("part_items", v.part_items.filter((_, i) => i !== index))}><Trash2 className="text-destructive" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => set("part_items", [...v.part_items, { description: "", value: "" }])}><Plus /> Adicionar peça</Button>
            <p className="text-sm">Total das peças: <strong className="text-primary">{formatBRL(piecesTotal)}</strong></p>
          </div>
        </div>
      </Section>

      <Section title="Valores e prazos">
        <F label="Mão de obra (R$)">
          <Input value={v.labor_value} onChange={(e) => set("labor_value", e.target.value)} inputMode="decimal" placeholder="0,00" />
        </F>
        <div className="flex flex-col justify-end rounded-sm border border-primary/40 bg-primary/10 px-4 py-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
          <span className="font-display text-2xl">{formatBRL(total)}</span>
        </div>
        <F label="Status">
          <Select value={v.status} onValueChange={(s) => set("status", s as OrderStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </F>
        <F label="Data de entrada">
          <Input type="date" value={v.entry_date} onChange={(e) => set("entry_date", e.target.value)} />
        </F>
        <F label="Previsão de entrega">
          <Input type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </F>
        <F label="Observações internas" wide>
          <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </F>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row print:hidden">
        <Button type="submit" size="lg" disabled={saving} className="h-12">
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {submitLabel}
        </Button>
        {extraActions}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
      <legend className="px-2 font-display text-sm uppercase text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}

function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "space-y-2 sm:col-span-2 lg:col-span-3" : "space-y-2"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
