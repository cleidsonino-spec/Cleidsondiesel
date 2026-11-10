import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { OrderForm, type OrderFormValues } from "@/components/painel/order-form";
import { supabase } from "@/integrations/supabase/client";
import { appointmentQuery } from "@/lib/queries";
import { todayISO } from "@/lib/schedule";
import { customersQuery, vehiclesQuery } from "@/lib/registry";

type Search = { agendamento?: string; cliente?: string; veiculo?: string };

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
      prefill={
        a
          ? {
              plate: a.plate,
              customer_name: a.customer_name,
              phone: a.phone,
              vehicle: a.vehicle,
              complaint: [a.service_type, a.notes].filter(Boolean).join(" — "),
            }
          : undefined
      }
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
    status: "recebido",
    entry_date: todayISO(),
    due_date: "",
    notes: "",
    inspection: { failedItems: "", observations: "" },
    ...prefill,
    ...(selectedCustomer ? { customer_id: selectedCustomer.id, customer_name: selectedCustomer.name, phone: selectedCustomer.phone ?? "" } : {}),
    ...(selectedVehicle ? { vehicle_id: selectedVehicle.id, plate: selectedVehicle.plate, vehicle: selectedVehicle.model, vehicle_year: selectedVehicle.year ?? "", mileage: selectedVehicle.mileage ?? "" } : {}),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Nova ordem de serviço</h1>
      <OrderForm
        initial={initial}
        submitLabel="Abrir OS"
        onSubmit={async (input) => {
          const { data: auth } = await supabase.auth.getUser();
          const { data, error } = await supabase
            .from("service_orders")
            .insert({ ...input, appointment_id: appointmentId ?? null, created_by: auth.user?.id ?? null })
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
          await qc.invalidateQueries({ queryKey: ["orders"] });
          toast.success(`OS nº ${data.number} aberta!`);
          navigate({ to: "/painel/ordens/$id", params: { id: data.id } });
        }}
      />
    </div>
  );
}
