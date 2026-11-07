import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeading, PublicLayout } from "@/components/site/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatPlate, isValidPlate, normalizePlate } from "@/lib/plate";
import { availableSlots, formatDateBR, getSlotsForDate, todayISO } from "@/lib/schedule";
import { SERVICE_OPTIONS } from "@/lib/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar serviço — Cleidson Diesel" },
      { name: "description", content: "Escolha o dia e o horário para trazer seu veículo diesel à oficina." },
      { property: "og:title", content: "Agendar serviço — Cleidson Diesel" },
      { property: "og:description", content: "Agende online a avaliação da sua bomba injetora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgendarPage,
});

function AgendarPage() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [service, setService] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ date: string; time: string; plate: string } | null>(null);

  const booked = useQuery({
    queryKey: ["booked-slots", date],
    enabled: !!date,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("booked_slots", { _date: date });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });

  const allSlots = date ? getSlotsForDate(date) : [];
  const free = date ? availableSlots(date, booked.data ?? []) : [];

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const plate = normalizePlate(String(fd.get("plate") ?? ""));
    const name = String(fd.get("name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const vehicle = String(fd.get("vehicle") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();

    if (name.length < 2) { toast.error("Informe seu nome."); return; }
    if (phone.replace(/\D/g, "").length < 10) { toast.error("Informe um telefone com DDD."); return; }
    if (!isValidPlate(plate)) { toast.error("Placa inválida. Ex: ABC1234 ou ABC1D23."); return; }
    if (vehicle.length < 2) { toast.error("Informe o modelo do veículo."); return; }
    if (!service) { toast.error("Escolha o tipo de serviço."); return; }
    if (!date || !time) { toast.error("Escolha a data e o horário."); return; }

    setSubmitting(true);
    const { error } = await supabase.from("appointments").insert({
      customer_name: name,
      phone,
      plate,
      vehicle,
      service_type: service,
      scheduled_date: date,
      scheduled_time: time,
      notes: notes || null,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Esse horário acabou de ser reservado. Escolha outro.");
        setTime("");
        booked.refetch();
      } else {
        toast.error(error.message.includes("domingo") ? "Não atendemos aos domingos." : "Não foi possível agendar. Tente novamente.");
      }
      return;
    }
    setDone({ date, time, plate });
  }

  if (done) {
    return (
      <PublicLayout>
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
          <CheckCircle2 className="size-16 text-success" />
          <h1 className="mt-6 text-4xl">Agendamento enviado!</h1>
          <p className="mt-4 text-muted-foreground">
            Recebemos seu pedido para <strong className="text-foreground">{formatDateBR(done.date)}</strong> às{" "}
            <strong className="text-foreground">{done.time}</strong>. A oficina vai confirmar pelo telefone informado.
          </p>
          <p className="mt-6 rounded-md border border-border bg-card px-5 py-3 plate text-2xl">{formatPlate(done.plate)}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link to="/consulta">Acompanhar pela placa</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PageHeading eyebrow="Agendamento online" title="Agendar serviço">
        Atendimento de segunda a sexta, das 08h às 17h.
      </PageHeading>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <form onSubmit={onSubmit} className="space-y-8">
          <fieldset className="grid gap-5 rounded-md border border-border bg-card p-5 md:grid-cols-2 md:p-6">
            <legend className="px-2 font-display text-sm uppercase text-primary">Seus dados</legend>
            <Field label="Nome completo" htmlFor="name">
              <Input id="name" name="name" autoComplete="name" required maxLength={120} />
            </Field>
            <Field label="WhatsApp / telefone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" required maxLength={30} />
            </Field>
          </fieldset>

          <fieldset className="grid gap-5 rounded-md border border-border bg-card p-5 md:grid-cols-2 md:p-6">
            <legend className="px-2 font-display text-sm uppercase text-primary">Veículo</legend>
            <Field label="Placa" htmlFor="plate">
              <Input id="plate" name="plate" placeholder="ABC1D23" required maxLength={8} className="plate uppercase" />
            </Field>
            <Field label="Modelo / ano" htmlFor="vehicle">
              <Input id="vehicle" name="vehicle" placeholder="Ex: Hilux 3.0 2010" required maxLength={120} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Serviço" htmlFor="service">
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger id="service">
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="O que o veículo está apresentando? (opcional)" htmlFor="notes">
                <Textarea id="notes" name="notes" rows={3} maxLength={1000} placeholder="Ex: fumaça preta, falta de força..." />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-5 rounded-md border border-border bg-card p-5 md:p-6">
            <legend className="px-2 font-display text-sm uppercase text-primary">Data e horário</legend>
            <Field label="Data" htmlFor="date">
              <Input
                id="date"
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime("");
                }}
                className="md:max-w-xs"
              />
            </Field>
            {date && allSlots.length === 0 && (
              <p className="text-sm text-destructive">Atendemos de segunda a sexta. Escolha um dia útil.</p>
            )}
            {date && allSlots.length > 0 && (
              <div>
                <p className="mb-3 text-sm text-muted-foreground">Horários disponíveis</p>
                {booked.isLoading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {allSlots.map((s) => {
                      const isFree = free.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={!isFree}
                          onClick={() => setTime(s)}
                          className={cn(
                            "rounded-sm border px-3 py-2.5 font-display text-sm transition-colors",
                            time === s
                              ? "border-primary bg-primary text-primary-foreground shadow-glow"
                              : "border-border bg-secondary hover:border-primary/60",
                            !isFree && "cursor-not-allowed opacity-30 line-through",
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full bg-gradient-primary text-base shadow-glow">
            {submitting ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
            Confirmar agendamento
          </Button>
        </form>
      </section>
    </PublicLayout>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
