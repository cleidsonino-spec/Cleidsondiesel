import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { formatBRL, ORDER_STATUSES, orderTotal, type OrderStatus } from "@/lib/status";

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
  parts_value: string;
  labor_value: string;
  status: OrderStatus;
  entry_date: string;
  due_date: string;
  notes: string;
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
    parts_value: parseMoney(v.parts_value),
    labor_value: parseMoney(v.labor_value),
    status: v.status,
    entry_date: v.entry_date,
    due_date: v.due_date || null,
    notes: v.notes.trim() || null,
  };
}

/** Aceita "1.234,56", "1234.56" ou "1234". */
export function parseMoney(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
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
    setSaving(true);
    try {
      await onSubmit(toOrderInput(v));
    } finally {
      setSaving(false);
    }
  }

  const total = orderTotal(parseMoney(v.parts_value), parseMoney(v.labor_value));

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

      <Section title="Valores e prazos">
        <F label="Valor das peças (R$)">
          <Input value={v.parts_value} onChange={(e) => set("parts_value", e.target.value)} inputMode="decimal" placeholder="0,00" />
        </F>
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
