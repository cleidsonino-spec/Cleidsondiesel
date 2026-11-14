import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Intake = {
  id: string;
  customer_name: string;
  vehicle: string;
  plate: string;
  received_at: string;
  received_by_name: string;
  notes: string | null;
};

export const Route = createFileRoute("/_authenticated/painel/recebimento")({
  head: () => ({ meta: [{ title: "Recebimento de veículos — Cleidson Diesel" }, { name: "robots", content: "noindex" }] }),
  component: VehicleIntakePage,
});

function VehicleIntakePage() {
  const { isAdmin, isSecretary } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const records = useQuery({
    queryKey: ["vehicle-intake-independent"],
    enabled: isAdmin || isSecretary,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vehicle_intake_records")
        .select("id,customer_name,vehicle,plate,received_at,received_by_name,notes")
        .order("received_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Intake[];
    },
  });

  if (!isAdmin && !isSecretary) {
    return <section className="rounded-md border p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente administração e secretaria podem registrar recebimentos.</p></section>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customer.trim().length < 2 || vehicle.trim().length < 2 || plate.trim().length < 5) {
      toast.error("Preencha cliente, veículo e placa.");
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("vehicle_intake_records").insert({
      customer_name: customer.trim(),
      vehicle: vehicle.trim(),
      plate: plate.trim().toUpperCase(),
      received_by: auth.user?.id,
      received_by_name: String(auth.user?.user_metadata?.full_name ?? auth.user?.user_metadata?.name ?? auth.user?.email ?? "").trim(),
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ficha de recebimento registrada.");
    setCustomer("");
    setVehicle("");
    setPlate("");
    setNotes("");
    await queryClient.invalidateQueries({ queryKey: ["vehicle-intake-independent"] });
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Cadastro independente da OS</p>
        <h1 className="flex items-center gap-2 text-3xl"><ClipboardCheck className="text-primary" />Recebimento de veículos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Registre a entrada do veículo antes de iniciar o atendimento.</p>
      </header>
      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-md border bg-card p-5">
        <h2 className="font-semibold">Nova ficha</h2>
        <div className="space-y-2"><Label htmlFor="intake-customer">Cliente *</Label><Input id="intake-customer" required minLength={2} maxLength={160} value={customer} onChange={e => setCustomer(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="intake-vehicle">Veículo *</Label><Input id="intake-vehicle" required minLength={2} maxLength={160} value={vehicle} onChange={e => setVehicle(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="intake-plate">Placa *</Label><Input id="intake-plate" required minLength={5} maxLength={12} value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} /></div>
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
            <p className="text-sm text-muted-foreground">Placa: {record.plate}</p>
            <p className="text-sm">Recebido em {new Date(record.received_at).toLocaleString("pt-BR")} por {record.received_by_name}</p>
            {record.notes && <p className="mt-2 whitespace-pre-wrap text-sm">Observações: {record.notes}</p>}
          </article>
        ))}
        {!records.isLoading && !records.isError && records.data?.length === 0 && <p className="rounded-md border p-4 text-sm text-muted-foreground">Nenhuma ficha registrada ainda.</p>}
      </section>
    </div>
  );
}
