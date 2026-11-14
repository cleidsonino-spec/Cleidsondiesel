import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { OrderForm, type OrderFormValues } from "@/components/painel/order-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { appointmentQuery } from "@/lib/queries";
import { todayISO } from "@/lib/schedule";
import { customersQuery, vehiclesQuery } from "@/lib/registry";

type Search = { agendamento?: string; cliente?: string; veiculo?: string };
type IntakeOption = { id: string; customer_name: string; vehicle: string; plate: string; received_at: string; received_by_name: string; notes: string | null };

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
  const [intakeId, setIntakeId] = useState("");

  const intakes = useQuery({
    queryKey: ["available-vehicle-intakes"],
    queryFn: async () => {
      const [{ data: records, error: intakeError }, { data: linked, error: orderError }] = await Promise.all([
        (supabase as any).from("vehicle_intake_records").select("id,customer_name,vehicle,plate,received_at,received_by_name,notes").order("received_at", { ascending: false }),
        (supabase as any).from("service_orders").select("vehicle_intake_id").not("vehicle_intake_id", "is", null),
      ]);
      if (intakeError) throw intakeError;
      if (orderError) throw orderError;
      const used = new Set((linked ?? []).map((row: { vehicle_intake_id: string }) => row.vehicle_intake_id));
      return (records ?? []).filter((row: IntakeOption) => !used.has(row.id)) as IntakeOption[];
    },
  });

  const selectedIntake = intakes.data?.find((item) => item.id === intakeId);
  const initial: OrderFormValues = {
    plate: "",
    customer_name: "",
    phone: "",
    vehicle: "",
    vehicle_year: "",
    mileage: "",
    complaint: "",
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
    ...(selectedIntake ? { customer_name: selectedIntake.customer_name, vehicle: selectedIntake.vehicle, plate: selectedIntake.plate } : {}),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Nova ordem de serviço</h1>
        <p className="mt-1 text-sm text-muted-foreground">Selecione a ficha de recebimento registrada separadamente para liberar a abertura da OS.</p>
      </div>
      <section className="max-w-2xl space-y-3 rounded-md border bg-card p-5">
        <Label htmlFor="order-intake">Ficha de recebimento *</Label>
        {intakes.isLoading && <p className="text-sm text-muted-foreground">Carregando fichas disponíveis…</p>}
        {intakes.isError && <p className="text-sm text-destructive">Não foi possível consultar as fichas. Verifique se a migration de recebimento foi aplicada.</p>}
        <Select value={intakeId} onValueChange={setIntakeId} disabled={intakes.isLoading || intakes.isError || !intakes.data?.length}>
          <SelectTrigger id="order-intake"><SelectValue placeholder="Selecione uma ficha de recebimento" /></SelectTrigger>
          <SelectContent>
            {(intakes.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.customer_name} · {item.vehicle} · {item.plate} · {new Date(item.received_at).toLocaleDateString("pt-BR")}</SelectItem>)}
          </SelectContent>
        </Select>
        {intakes.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ficha disponível. Registre primeiro o veículo em Recebimento de veículos.</p>}
        {selectedIntake && <p className="text-xs text-muted-foreground">Recebido por {selectedIntake.received_by_name}{selectedIntake.notes ? ` · Observação: ${selectedIntake.notes}` : ""}</p>}
      </section>
      {selectedIntake && (
        <OrderForm
          key={intakeId}
          initial={initial}
          submitLabel="Abrir OS"
          onSubmit={async (input) => {
            const { data: auth } = await supabase.auth.getUser();
            const { data, error } = await (supabase as any)
              .from("service_orders")
              .insert({ ...input, vehicle_intake_id: intakeId, appointment_id: appointmentId ?? null, created_by: auth.user?.id ?? null })
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
            await Promise.all([
              qc.invalidateQueries({ queryKey: ["orders"] }),
              qc.invalidateQueries({ queryKey: ["available-vehicle-intakes"] }),
            ]);
            toast.success(`OS nº ${data.number} aberta!`);
            navigate({ to: "/painel/ordens/$id", params: { id: data.id } });
          }}
        />
      )}
    </div>
  );
}
