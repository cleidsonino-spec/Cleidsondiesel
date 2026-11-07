import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { OrderForm, type OrderFormValues } from "@/components/painel/order-form";
import { supabase } from "@/integrations/supabase/client";
import { appointmentQuery } from "@/lib/queries";
import { todayISO } from "@/lib/schedule";

type Search = { agendamento?: string };

export const Route = createFileRoute("/_authenticated/painel/ordens/nova")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["agendamento"] === "string" ? { agendamento: s["agendamento"] } : {},
  loaderDeps: ({ search }) => ({ agendamento: search.agendamento }),
  loader: async ({ context, deps }) => {
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
    parts_value: "",
    labor_value: "",
    status: "recebido",
    entry_date: todayISO(),
    due_date: "",
    notes: "",
    ...prefill,
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
            toast.error("Não foi possível salvar a OS.");
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
