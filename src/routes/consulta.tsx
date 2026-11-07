import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageHeading, PublicLayout } from "@/components/site/public-layout";
import { StatusBadge } from "@/components/site/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatPlate, isValidPlate, normalizePlate } from "@/lib/plate";
import { formatDateBR } from "@/lib/schedule";
import { ORDER_PROGRESS, orderStatusInfo } from "@/lib/status";
import { cn } from "@/lib/utils";

type LookupRow = Database["public"]["Functions"]["lookup_plate"]["Returns"][number];

export const Route = createFileRoute("/consulta")({
  head: () => ({
    meta: [
      { title: "Consultar pela placa — Cleidson Diesel" },
      { name: "description", content: "Acompanhe o andamento do serviço do seu veículo digitando a placa." },
      { property: "og:title", content: "Consultar pela placa — Cleidson Diesel" },
      { property: "og:description", content: "Veja em que etapa está o serviço do seu veículo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsultaPage,
});

function ConsultaPage() {
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ plate: string; rows: LookupRow[] } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const p = normalizePlate(plate);
    if (!isValidPlate(p)) {
      setError("Digite uma placa válida. Ex: ABC1234 ou ABC1D23.");
      return;
    }
    setError(null);
    setLoading(true);
    const { data, error: err } = await supabase.rpc("lookup_plate", { _plate: p });
    setLoading(false);
    if (err) {
      setError("Não foi possível consultar agora. Tente novamente.");
      return;
    }
    setResult({ plate: p, rows: data ?? [] });
  }

  return (
    <PublicLayout>
      <PageHeading eyebrow="Acompanhamento" title="Consultar pela placa">
        Digite a placa do seu veículo para ver em que etapa está o serviço.
      </PageHeading>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="ABC1D23"
            maxLength={8}
            aria-label="Placa do veículo"
            className="plate h-14 flex-1 text-center text-2xl sm:text-left"
          />
          <Button type="submit" size="lg" disabled={loading} className="h-14 px-8 text-base">
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
            Consultar
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {result && (
          <div className="mt-10 space-y-5">
            {result.rows.length === 0 ? (
              <div className="rounded-md border border-border bg-card p-8 text-center">
                <p className="plate text-2xl">{formatPlate(result.plate)}</p>
                <p className="mt-3 text-muted-foreground">
                  Nenhum serviço encontrado para essa placa. Se você acabou de agendar, a ordem de
                  serviço é aberta quando o veículo chega na oficina.
                </p>
              </div>
            ) : (
              result.rows.map((row) => <OrderCard key={row.number} row={row} plate={result.plate} />)
            )}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

function OrderCard({ row, plate }: { row: LookupRow; plate: string }) {
  const info = orderStatusInfo(row.status);
  const currentIdx = ORDER_PROGRESS.indexOf(row.status);
  return (
    <article className="overflow-hidden rounded-md border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/60 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">OS nº {row.number}</p>
          <p className="plate text-xl">{formatPlate(plate)}</p>
        </div>
        <StatusBadge tone={info.tone} label={info.label} />
      </div>
      <div className="space-y-5 p-5">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Info label="Veículo" value={row.vehicle} />
          <Info label="Entrada" value={formatDateBR(row.entry_date)} />
          <Info label="Previsão" value={formatDateBR(row.due_date)} />
        </div>
        <Info label="Serviço" value={row.complaint} />
        {row.status !== "cancelado" && (
          <ol className="grid grid-cols-6 gap-1 pt-2">
            {ORDER_PROGRESS.map((s, i) => {
              const reached = i <= currentIdx;
              return (
                <li key={s} className="flex flex-col items-center gap-2 text-center">
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full border text-xs",
                      reached ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {reached ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn("text-[10px] leading-tight sm:text-xs", reached ? "text-foreground" : "text-muted-foreground")}>
                    {orderStatusInfo(s).label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value || "—"}</p>
    </div>
  );
}
