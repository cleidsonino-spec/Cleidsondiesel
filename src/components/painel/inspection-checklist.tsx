import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INSPECTION_STATUSES, type InspectionItem } from "@/lib/inspection";

export function InspectionChecklist({ items, onChange }: { items: InspectionItem[]; onChange: (items: InspectionItem[]) => void }) {
  const update = (id: string, patch: Partial<InspectionItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <fieldset className="space-y-4 border-t border-border pt-5">
    <legend className="pr-3 font-display text-sm uppercase text-primary">Checklist de inspeção</legend>
    <p className="text-sm text-muted-foreground">{items.filter((item) => item.status !== "pending").length} de {items.length} itens verificados</p>
    <div className="divide-y divide-border">
      {items.map((item, index) => <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_190px_40px]">
        <Input aria-label={`Item de inspeção ${index + 1}`} value={item.label} onChange={(e) => update(item.id, { label: e.target.value })} placeholder="Item de inspeção" />
        <Select value={item.status} onValueChange={(value) => update(item.id, { status: INSPECTION_STATUSES.find((s) => s.value === value)?.value ?? "pending" })}>
          <SelectTrigger aria-label={`Resultado da inspeção ${index + 1}`} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{INSPECTION_STATUSES.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" size="icon" variant="ghost" aria-label={`Remover inspeção ${index + 1}`} title="Remover item" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><Trash2 className="text-destructive" /></Button>
        <Input className="sm:col-span-3" aria-label={`Observações da inspeção ${index + 1}`} placeholder="Observações" value={item.notes} onChange={(e) => update(item.id, { notes: e.target.value })} />
      </div>)}
    </div>
    <Button type="button" variant="outline" onClick={() => onChange([...items, { id: crypto.randomUUID(), label: "", status: "pending", notes: "" }])}><Plus /> Adicionar item</Button>
  </fieldset>;
}