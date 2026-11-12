import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Award, CheckCircle2, ClipboardCheck, Users } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/painel/desempenho-mecanicos")({
  head: () => ({ meta: [
    { title: "Desempenho dos mecânicos — Cleidson Diesel" },
    { name: "description", content: "Quantidade de ordens de serviço concluídas por mecânico." },
    { name: "robots", content: "noindex" },
  ] }),
  component: MechanicPerformancePage,
});

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

type Completion = {
  service_order_id: string;
  mechanic_user_id: string;
  completed_at: string;
};

type StaffName = {
  accepted_user_id: string;
  full_name: string;
};

function MechanicPerformancePage() {
  const today = localDate(new Date());
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);

  const report = useQuery({
    queryKey: ["mechanic-completions-report", from, to],
    queryFn: async () => {
      const start = new Date(`${from}T00:00:00`).toISOString();
      const end = new Date(`${shiftDate(to, 1)}T00:00:00`).toISOString();
      const rows: Completion[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await (supabase as any)
          .from("service_order_completions")
          .select("service_order_id, mechanic_user_id, completed_at")
          .gte("completed_at", start)
          .lt("completed_at", end)
          .order("completed_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const page = (data ?? []) as Completion[];
        rows.push(...page);
        if (page.length < pageSize) break;
      }
      const ids = [...new Set(rows.map((row) => row.mechanic_user_id))];
      let names: StaffName[] = [];
      if (ids.length) {
        const { data, error: staffError } = await (supabase as any)
          .from("staff_invitations")
          .select("accepted_user_id, full_name")
          .in("accepted_user_id", ids);
        if (staffError) throw staffError;
        names = (data ?? []) as StaffName[];
      }
      const nameById = new Map(names.map((person) => [person.accepted_user_id, person.full_name]));
      const totals = new Map<string, { mechanicId: string; name: string; count: number; latest: string }>();
      for (const row of rows) {
        const existing = totals.get(row.mechanic_user_id);
        if (existing) {
          existing.count += 1;
        } else {
          totals.set(row.mechanic_user_id, {
            mechanicId: row.mechanic_user_id,
            name: nameById.get(row.mechanic_user_id) || "Mecânico não identificado",
            count: 1,
            latest: row.completed_at,
          });
        }
      }
      return {
        total: rows.length,
        mechanics: [...totals.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      };
    },
  });

  const top = report.data?.mechanics[0];
  const totalMechanics = report.data?.mechanics.length ?? 0;

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Equipe · produtividade</p>
        <h1 className="text-3xl">Desempenho dos mecânicos</h1>
        <p className="text-sm text-muted-foreground">Contagem de ordens de serviço concluídas por cada mecânico.</p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4" aria-label="Filtro do relatório">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">De</span>
          <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Até</span>
          <input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} className="rounded-md border border-input bg-background px-3 py-2" />
        </label>
        <p className="pb-2 text-xs text-muted-foreground">Período: {formatDateBR(from)} a {formatDateBR(to)}</p>
      </section>

      {report.isLoading ? (
        <p className="rounded-md border p-6 text-sm text-muted-foreground">Carregando desempenho da equipe…</p>
      ) : report.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="font-semibold">Não foi possível carregar o relatório</h2>
          <p className="mt-1 text-sm text-muted-foreground">{report.error instanceof Error ? report.error.message : "Verifique se a estrutura de registros de conclusão foi aplicada."}</p>
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo do período">
            <article className="rounded-md border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardCheck className="size-4" /> Serviços concluídos</div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{report.data?.total ?? 0}</p>
            </article>
            <article className="rounded-md border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" /> Mecânicos com conclusão</div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{totalMechanics}</p>
            </article>
            <article className="rounded-md border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Award className="size-4" /> Maior quantidade</div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{top?.count ?? 0}</p>
              <p className="text-sm text-muted-foreground">{top?.name ?? "Sem registros no período"}</p>
            </article>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">Serviços concluídos por mecânico</h2>
              <p className="text-sm text-muted-foreground">Cada ordem é contabilizada uma única vez, para o mecânico que registrou a conclusão.</p>
            </div>
            {report.data?.mechanics.length ? (
              <div className="overflow-hidden rounded-md border bg-card">
                {report.data.mechanics.map((mechanic, index) => (
                  <article key={mechanic.mechanicId} className="flex items-center justify-between gap-4 border-b p-4 last:border-b-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{mechanic.name}</p>
                        <p className="text-xs text-muted-foreground">Conclusões registradas no período</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      <CheckCircle2 className="size-4 text-primary" />
                      <span className="text-2xl font-semibold tabular-nums">{mechanic.count}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum serviço concluído foi registrado neste período.</p>
            )}
          </section>
        </>
      )}
      <p className="text-xs text-muted-foreground">Este indicador considera somente a quantidade de serviços concluídos. Não exibe faturamento, valores ou comissões. Registros anteriores à implantação do controle não são atribuídos retroativamente.</p>
    </main>
  );
}
