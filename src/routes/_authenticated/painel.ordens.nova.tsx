import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { OrderForm, type OrderFormValues } from "@/components/painel/order-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { appointmentQuery } from "@/lib/queries";
import { todayISO } from "@/lib/schedule";
import { customersQuery, vehiclesQuery } from "@/lib/registry";

type Search = { agendamento?: string; cliente?: string; veiculo?: string };
type IntakeType = "vehicle" | "pump_injector";
type DeliveredItem = { description: string; quantity: string };
type IntakeOption = {
  id: string; customer_name: string; vehicle: string; plate: string | null;
  intake_type: IntakeType; arrived_on_tow_truck: boolean | null;
  delivered_items: { description: string; quantity: number }[]; notes: string | null;
};

export const Route = createFileRoute("/_authenticated/painel/ordens/nova")({
  head: () => ({ meta: [
    { title: "Nova ordem de serviço — Cleidson Diesel" },
    { name: "description", content: "Registre clientes, serviços e peças na Cleidson Diesel." },
    { property: "og:title", content: "Nova ordem de serviço — Cleidson Diesel" },
    { property: "og:description", content: "Cadastro de ordens de serviço da oficina." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>): Search =>
    ({ ...(typeof s["agendamento"] === "string" ? { agendamento: s["agendamento"] } : {}), ...(typeof s["cliente"] === "string" ? { cliente: s["cliente"] } : {}), ...(typeof s["veiculo"] === "string" ? { veiculo: s["veiculo"] } : {}) }),
  loaderDeps: ({ search }) => ({ agendamento: search.agendamento }),
  loader: async ({ context, deps }) => {
    await Promise.all([context.queryClient.ensureQueryData(customersQuery()), context.queryClient.ensureQueryData(vehiclesQuery())]);
    if (deps.agendamento) await context.queryClient.ensureQueryData(appointmentQuery(deps.agendamento));
  },
  component: NovaOS,
});

function NovaOS() {
  const { agendamento } = Route.useSearch();
  return agendamento ? <FromAppointment id={agendamento} /> : <NovaOSForm />;
}

function FromAppointment({ id }: { id: string }) {
  const { data: a } = useSuspenseQuery(appointmentQuery(id));
  return (
    <NovaOSForm
      appointmentId={a?.id}
      prefill={a ? {
        plate: a.plate,
        customer_name: a.customer_name,
        phone: a.phone,
        vehicle: a.vehicle,
        complaint: [a.service_type, a.notes].filter(Boolean).join(" — "),
      } : undefined}
    />
  );
}

function NovaOSForm({ prefill, appointmentId }: { prefill?: Partial<OrderFormValues> | undefined; appointmentId?: string | undefined }) {
  const { cliente, veiculo } = Route.useSearch();
  const { data: customers } = useSuspenseQuery(customersQuery());
  const { data: vehicles } = useSuspenseQuery(vehiclesQuery());
  const selectedVehicle = vehicles.find((v) => v.id === veiculo);
  const selectedCustomer = customers.find((c) => c.id === (selectedVehicle?.customer_id ?? cliente));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [intakeType, setIntakeType] = useState<IntakeType>("vehicle");
  const [customer, setCustomer] = useState(prefill?.customer_name ?? selectedCustomer?.name ?? "");
  const [vehicle, setVehicle] = useState(prefill?.vehicle ?? selectedVehicle?.model ?? "");
  const [plate, setPlate] = useState(prefill?.plate ?? selectedVehicle?.plate ?? "");
  const [towTruck, setTowTruck] = useState("no");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveredItem[]>([{ description: "", quantity: "1" }]);
  const [savingIntake, setSavingIntake] = useState(false);
  const [intake, setIntake] = useState<IntakeOption | null>(null);

  const initial: OrderFormValues = {
    plate: intake?.plate ?? "",
    customer_name: customer,
    phone: prefill?.phone ?? selectedCustomer?.phone ?? "",
    vehicle: intake?.vehicle ?? vehicle,
    vehicle_year: selectedVehicle?.year ?? "",
    mileage: selectedVehicle?.mileage ?? "",
    complaint: prefill?.complaint ?? "",
    diagnosis: "",
    parts: "",
    part_items: [{ description: "", quantity: "1", unit_value: "" }],
    labor_value: "",
    discount_percent: "0",
    status: "recebido",
    entry_date: todayISO(),
    due_date: "",
    notes: "",
    inspection: { failedItems: "", observations: "" },
    ...prefill,
    ...(selectedCustomer ? { customer_id: selectedCustomer.id, customer_name: selectedCustomer.name, phone: selectedCustomer.phone ?? "" } : {}),
    ...(selectedVehicle ? { vehicle_id: selectedVehicle.id, plate: selectedVehicle.plate, vehicle: selectedVehicle.model, vehicle_year: selectedVehicle.year ?? "", mileage: selectedVehicle.mileage ?? "" } : {}),
    ...(intake ? { customer_name: intake.customer_name, vehicle: intake.vehicle, plate: intake.plate ?? "" } : {}),
  };

  async function registerIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customer.trim().length < 2) { toast.error("Informe o nome do cliente."); return; }
    if (intakeType === "vehicle" && (vehicle.trim().length < 2 || plate.trim().length < 5)) {
      toast.error("Para recebimento de veículo, informe o modelo e a placa."); return;
    }
    if (intakeType === "pump_injector" && items.some(item => item.description.trim().length < 2 || !/^[1-9][0-9]*$/.test(item.quantity))) {
      toast.error("Descreva cada item entregue e informe uma quantidade inteira maior que zero."); return;
    }
    setSavingIntake(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const receivedByName = String(auth.user?.user_metadata?.full_name ?? auth.user?.user_metadata?.name ?? auth.user?.email ?? "Administração").trim();
      const intakeVehicle = intakeType === "vehicle" ? vehicle.trim() : "Bomba/bicos injetores";
      const payload = {
        intake_type: intakeType,
        customer_name: customer.trim(),
        vehicle: intakeVehicle,
        plate: intakeType === "vehicle" ? plate.trim().toUpperCase() : null,
        arrived_on_tow_truck: intakeType === "vehicle" ? towTruck === "yes" : null,
        delivered_items: intakeType === "pump_injector" ? items.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity) })) : [],
        received_by: auth.user?.id,
        received_by_name: receivedByName.length >= 2 ? receivedByName : "Administração",
        notes: notes.trim() || null,
      };
      const { data, error } = await (supabase as any).from("vehicle_intake_records").insert(payload)
        .select("id,customer_name,vehicle,plate,intake_type,arrived_on_tow_truck,delivered_items,notes").single();
      if (error) throw error;
      setIntake(data as IntakeOption);
      toast.success("Ficha de recebimento registrada. Complete os dados da ordem de serviço.");
      await qc.invalidateQueries({ queryKey: ["vehicle-intake-independent"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a ficha.");
    } finally {
      setSavingIntake(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Nova ordem de serviço</h1>
        <p className="mt-1 text-sm text-muted-foreground">Primeiro registre o recebimento; em seguida, o sistema libera a abertura da OS.</p>
      </div>
      {!intake ? (
        <form onSubmit={registerIntake} className="max-w-2xl space-y-4 rounded-md border bg-card p-5">
          <h2 className="font-semibold">Ficha de recebimento obrigatória</h2>
          <div className="space-y-2">
            <Label htmlFor="intake-type">O que está sendo recebido? *</Label>
            <Select value={intakeType} onValueChange={(value) => setIntakeType(value as IntakeType)}>
              <SelectTrigger id="intake-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vehicle">Recebimento de veículo</SelectItem>
                <SelectItem value="pump_injector">Cliente trouxe bomba/bicos em mãos para testes e reparo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="intake-customer">Cliente *</Label><Input id="intake-customer" required minLength={2} maxLength={160} value={customer} onChange={e => setCustomer(e.target.value)} /></div>
          {intakeType === "vehicle" ? (
            <>
              <div className="space-y-2"><Label htmlFor="intake-vehicle">Veículo *</Label><Input id="intake-vehicle" required minLength={2} maxLength={160} value={vehicle} onChange={e => setVehicle(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="intake-plate">Placa *</Label><Input id="intake-plate" required minLength={5} maxLength={12} value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} /></div>
              <div className="space-y-2">
                <Label htmlFor="intake-tow">O veículo chegou no reboque? *</Label>
                <Select value={towTruck} onValueChange={setTowTruck}><SelectTrigger id="intake-tow"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Sim</SelectItem><SelectItem value="no">Não</SelectItem></SelectContent></Select>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div><h3 className="font-medium">Itens entregues *</h3><p className="text-sm text-muted-foreground">Descreva cada componente e informe a quantidade recebida.</p></div>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_100px_40px] items-end gap-2">
                  <div className="space-y-2"><Label htmlFor={"delivered-item-"+index}>Descrição do item {index+1}</Label><Input id={"delivered-item-"+index} required value={item.description} onChange={e => setItems(current => current.map((v,i) => i===index ? {...v,description:e.target.value} : v))} placeholder="Ex.: Bomba injetora Bosch" /></div>
                  <div className="space-y-2"><Label htmlFor={"delivered-qty-"+index}>Quantidade</Label><Input id={"delivered-qty-"+index} required type="number" min="1" step="1" value={item.quantity} onChange={e => setItems(current => current.map((v,i) => i===index ? {...v,quantity:e.target.value} : v))} /></div>
                  <Button type="button" variant="outline" disabled={items.length===1} onClick={() => setItems(current => current.filter((_,i)=>i!==index))} aria-label="Remover item">×</Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setItems(current => [...current,{description:"",quantity:"1"}])}>Adicionar item</Button>
            </div>
          )}
          <div className="space-y-2"><Label htmlFor="intake-notes">Observações (opcional)</Label><Textarea id="intake-notes" maxLength={2000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">A data e o responsável pelo recebimento são registrados automaticamente.</p>
          <Button type="submit" disabled={savingIntake}>{savingIntake ? "Registrando recebimento…" : "Registrar recebimento e continuar"}</Button>
        </form>
      ) : (
        <>
          <section className="max-w-2xl space-y-2 rounded-md border bg-card p-5">
            <h2 className="font-semibold">Recebimento registrado</h2>
            <p className="text-sm">{intake.customer_name} · {intake.vehicle}{intake.plate ? " · Placa "+intake.plate : " · Sem placa (bomba/bicos)"}</p>
            {intake.intake_type === "pump_injector" && <ul className="list-disc pl-5 text-sm">{intake.delivered_items.map((item,index)=><li key={index}>{item.description} — quantidade: {item.quantity}</li>)}</ul>}
            {intake.intake_type === "vehicle" && <p className="text-sm">Chegou no reboque: {intake.arrived_on_tow_truck ? "Sim" : "Não"}</p>}
            {intake.notes && <p className="text-sm text-muted-foreground">Observações: {intake.notes}</p>}
          </section>
          <OrderForm
            key={intake.id}
            initial={initial}
            plateRequired={intake.intake_type === "vehicle"}
            submitLabel="Abrir OS"
            onSubmit={async (input) => {
              const { data: auth } = await supabase.auth.getUser();
              const { data, error } = await (supabase as any)
                .from("service_orders")
                .insert({ ...input, plate: intake.intake_type === "vehicle" ? input.plate : null, vehicle_intake_id: intake.id, appointment_id: appointmentId ?? null, created_by: auth.user?.id ?? null })
                .select("id, number")
                .single();
              if (error) {
                console.error("Erro ao salvar nova OS:", error);
                toast.error(`Falha ao salvar: ${error.message}`);
                return;
              }
              if (appointmentId) {
                await supabase.from("appointments").update({ status: "concluido" }).eq("id", appointmentId);
                qc.invalidateQueries({ queryKey: ["appointments"] });
              }
              await Promise.all([qc.invalidateQueries({ queryKey: ["orders"] }), qc.invalidateQueries({ queryKey: ["available-vehicle-intakes"] })]);
              toast.success(`OS nº ${data.number} aberta!`);
              navigate({ to: "/painel/ordens/$id", params: { id: data.id } });
            }}
          />
        </>
      )}
    </div>
  );
}
