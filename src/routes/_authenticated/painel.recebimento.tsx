import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type IntakeType = "vehicle" | "pump_injector";
type DeliveredItem = { description: string; quantity: string };
type Intake = {
  id: string; customer_name: string; vehicle: string; plate: string | null;
  intake_type: IntakeType; arrived_on_tow_truck: boolean | null;
  delivered_items: { description: string; quantity: number }[];
  received_at: string; received_by_name: string; notes: string | null;
};

export const Route = createFileRoute("/_authenticated/painel/recebimento")({
  head: () => ({ meta: [{ title: "Recebimento — Cleidson Diesel" }, { name: "robots", content: "noindex" }] }),
  component: VehicleIntakePage,
});

function VehicleIntakePage() {
  const { isAdmin, isSecretary } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [type, setType] = useState<IntakeType>("vehicle");
  const [customer, setCustomer] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [towTruck, setTowTruck] = useState("no");
  const [items, setItems] = useState<DeliveredItem[]>([{ description: "", quantity: "1" }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const records = useQuery({
    queryKey: ["vehicle-intake-independent"],
    enabled: isAdmin || isSecretary,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vehicle_intake_records")
        .select("id,customer_name,vehicle,plate,intake_type,arrived_on_tow_truck,delivered_items,received_at,received_by_name,notes")
        .order("received_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as Intake[];
    },
  });

  if (!isAdmin && !isSecretary) {
    return <section className="rounded-md border p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente administração e secretaria podem registrar recebimentos.</p></section>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customer.trim().length < 2) { toast.error("Informe o nome do cliente."); return; }
    if (type === "vehicle" && (vehicle.trim().length < 2 || plate.trim().length < 5)) { toast.error("Preencha veículo e placa."); return; }
    if (type === "pump_injector" && items.some(item => item.description.trim().length < 2 || !/^[1-9][0-9]*$/.test(item.quantity))) {
      toast.error("Informe a descrição e a quantidade inteira de cada item."); return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const receivedByName = String(auth.user?.user_metadata?.["full_name"] ?? auth.user?.user_metadata?.["name"] ?? auth.user?.email ?? "Administração").trim();
      const { error } = await (supabase as any).from("vehicle_intake_records").insert({
        intake_type: type,
        customer_name: customer.trim(),
        vehicle: type === "vehicle" ? vehicle.trim() : "Bomba/bicos injetores",
        plate: type === "vehicle" ? plate.trim().toUpperCase() : null,
        arrived_on_tow_truck: type === "vehicle" ? towTruck === "yes" : null,
        delivered_items: type === "pump_injector" ? items.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity) })) : [],
        received_by: auth.user?.id,
        received_by_name: receivedByName.length >= 2 ? receivedByName : "Administração",
        notes: notes.trim() || null,
      });
      if (error) throw error;
      toast.success("Ficha de recebimento registrada.");
      setCustomer(""); setVehicle(""); setPlate(""); setNotes("");
      setType("vehicle"); setTowTruck("no"); setItems([{ description: "", quantity: "1" }]);
      await queryClient.invalidateQueries({ queryKey: ["vehicle-intake-independent"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o recebimento.");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Cadastro independente da OS</p>
        <h1 className="flex items-center gap-2 text-3xl"><ClipboardCheck className="text-primary" />Recebimento</h1>
        <p className="mt-1 text-sm text-muted-foreground">Registre veículos ou bombas/bicos entregues em mãos.</p>
      </header>
      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-md border bg-card p-5">
        <h2 className="font-semibold">Nova ficha</h2>
        <div className="space-y-2"><Label>Modalidade de recebimento *</Label>
          <Select value={type} onValueChange={value => setType(value as IntakeType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vehicle">Recebimento de veículo</SelectItem><SelectItem value="pump_injector">Bomba/bicos trazidos em mãos</SelectItem></SelectContent></Select>
        </div>
        <div className="space-y-2"><Label htmlFor="intake-customer">Cliente *</Label><Input id="intake-customer" required minLength={2} maxLength={160} value={customer} onChange={e => setCustomer(e.target.value)} /></div>
        {type === "vehicle" ? <>
          <div className="space-y-2"><Label htmlFor="intake-vehicle">Veículo *</Label><Input id="intake-vehicle" required minLength={2} maxLength={160} value={vehicle} onChange={e => setVehicle(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="intake-plate">Placa *</Label><Input id="intake-plate" required minLength={5} maxLength={12} value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} /></div>
          <div className="space-y-2"><Label>O veículo chegou no reboque? *</Label><Select value={towTruck} onValueChange={setTowTruck}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Sim</SelectItem><SelectItem value="no">Não</SelectItem></SelectContent></Select></div>
        </> : <section className="space-y-3">
          <div><h3 className="font-medium">Itens entregues *</h3><p className="text-sm text-muted-foreground">Descreva cada item e informe a quantidade recebida.</p></div>
          {items.map((item,index)=><div key={index} className="grid grid-cols-[minmax(0,1fr)_100px_40px] items-end gap-2">
            <div className="space-y-2"><Label htmlFor={"intake-item-"+index}>Descrição</Label><Input id={"intake-item-"+index} required value={item.description} onChange={e=>setItems(current=>current.map((v,i)=>i===index?{...v,description:e.target.value}:v))} placeholder="Ex.: Bico injetor" /></div>
            <div className="space-y-2"><Label htmlFor={"intake-qty-"+index}>Quantidade</Label><Input id={"intake-qty-"+index} required type="number" min="1" step="1" value={item.quantity} onChange={e=>setItems(current=>current.map((v,i)=>i===index?{...v,quantity:e.target.value}:v))} /></div>
            <Button type="button" variant="outline" disabled={items.length===1} onClick={()=>setItems(current=>current.filter((_,i)=>i!==index))} aria-label="Remover item">×</Button>
          </div>)}
          <Button type="button" variant="outline" onClick={()=>setItems(current=>[...current,{description:"",quantity:"1"}])}>Adicionar item</Button>
        </section>}
        <div className="space-y-2"><Label htmlFor="intake-notes">Observações (opcional)</Label><Textarea id="intake-notes" maxLength={2000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">A data e o responsável pelo recebimento são registrados automaticamente.</p>
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Registrar recebimento"}</Button>
      </form>
      <section className="space-y-3">
        <h2 className="font-semibold">Histórico de recebimentos</h2>
        {records.isLoading && <p className="rounded-md border p-4 text-sm">Carregando fichas…</p>}
        {records.isError && <p className="rounded-md border p-4 text-sm text-destructive">Não foi possível carregar o histórico.</p>}
        {(records.data ?? []).map(record => (
          <article key={record.id} className="rounded-md border p-4">
            <p className="font-semibold">{record.customer_name} · {record.vehicle}</p>
            <p className="text-sm text-muted-foreground">{record.intake_type === "vehicle" ? "Placa: "+record.plate+" · Chegou no reboque: "+(record.arrived_on_tow_truck ? "Sim" : "Não") : "Bomba/bicos entregues em mãos"}</p>
            {record.delivered_items?.length > 0 && <ul className="list-disc pl-5 text-sm">{record.delivered_items.map((item,index)=><li key={index}>{item.description} — quantidade: {item.quantity}</li>)}</ul>}
            <p className="text-sm">Recebido em {new Date(record.received_at).toLocaleString("pt-BR")} por {record.received_by_name}</p>
            {record.notes && <p className="mt-2 whitespace-pre-wrap text-sm">Observações: {record.notes}</p>}
          </article>
        ))}
        {!records.isLoading && !records.isError && records.data?.length === 0 && <p className="rounded-md border p-4 text-sm text-muted-foreground">Nenhuma ficha registrada ainda.</p>}
      </section>
    </div>
  );
}
