import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, BookOpen, Boxes, CheckCircle2, Fuel, Gauge, Search, Wrench } from "lucide-react";

import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel/central-tecnica")({
  head: () => ({ meta: [
    { title: "Central Técnica — Cleidson Diesel" },
    { name: "description", content: "Consulta técnica de bombas injetoras, bicos injetores e sistemas Common Rail." },
    { name: "robots", content: "noindex" },
  ] }),
  component: CentralTecnicaPage,
});

const areas = [
  { id: "bombas", title: "Bombas injetoras", description: "Modelos, componentes e referências cadastrados.", icon: Fuel },
  { id: "bicos", title: "Bicos injetores", description: "Componentes e referências cadastrados.", icon: Gauge },
  { id: "common-rail", title: "Common Rail", description: "Componentes e sistemas cadastrados.", icon: Boxes },
] as const;

type TechnicalResult = {
  id: string;
  title: string;
  code: string | null;
  model: string | null;
  manufacturer: string | null;
  category: string | null;
  status: string;
  kind: "Componente" | "Referência" | "Motor" | "Fabricante";
  detail: string | null;
};

function statusLabel(status: string) {
  if (status === "documented") return "Documentado";
  if (status === "pending_validation") return "Pendente de validação";
  return status || "Status não informado";
}

function CentralTecnicaPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TechnicalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedSearch = search.trim();

  useEffect(() => {
    let active = true;
    if (normalizedSearch.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return () => { active = false; };
    }

    const runSearch = async () => {
      setLoading(true);
      setError(null);
      const db = supabase as any;
      const pattern = `%${normalizedSearch}%`;
      try {
        const [byName, byCode, byModel, references, engines, manufacturers] = await Promise.all([
          db.from("technical_components").select("id,name,component_code,model,information_status,technical_manufacturers(name),technical_categories(name)").ilike("name", pattern).limit(12),
          db.from("technical_components").select("id,name,component_code,model,information_status,technical_manufacturers(name),technical_categories(name)").ilike("component_code", pattern).limit(12),
          db.from("technical_components").select("id,name,component_code,model,information_status,technical_manufacturers(name),technical_categories(name)").ilike("model", pattern).limit(12),
          db.from("technical_references").select("id,reference_code,relation_type,information_status,source_description,technical_components(name,component_code,model)").ilike("reference_code", pattern).limit(12),
          db.from("technical_engines").select("id,model,engine_code,family,information_status,technical_manufacturers(name)").or(`model.ilike.${pattern},engine_code.ilike.${pattern},family.ilike.${pattern}`).limit(12),
          db.from("technical_manufacturers").select("id,name").ilike("name", pattern).eq("is_active", true).limit(8),
        ]);
        const failures = [byName, byCode, byModel, references, engines, manufacturers].find((response) => response.error);
        if (failures?.error) throw failures.error;

        const componentRows = [...(byName.data ?? []), ...(byCode.data ?? []), ...(byModel.data ?? [])];
        const mappedComponents: TechnicalResult[] = componentRows.map((row: any) => ({
          id: row.id,
          title: row.name,
          code: row.component_code,
          model: row.model,
          manufacturer: row.technical_manufacturers?.name ?? null,
          category: row.technical_categories?.name ?? null,
          status: row.information_status,
          kind: "Componente",
          detail: null,
        }));
        const mappedReferences: TechnicalResult[] = (references.data ?? []).map((row: any) => ({
          id: row.id,
          title: row.technical_components?.name ?? "Componente relacionado não identificado",
          code: row.reference_code,
          model: row.technical_components?.model ?? null,
          manufacturer: null,
          category: null,
          status: row.information_status,
          kind: "Referência",
          detail: row.source_description ?? row.relation_type,
        }));
        const mappedEngines: TechnicalResult[] = (engines.data ?? []).map((row: any) => ({
          id: row.id,
          title: row.model,
          code: row.engine_code,
          model: row.family,
          manufacturer: row.technical_manufacturers?.name ?? null,
          category: null,
          status: row.information_status,
          kind: "Motor",
          detail: null,
        }));
        const mappedManufacturers: TechnicalResult[] = (manufacturers.data ?? []).map((row: any) => ({
          id: row.id,
          title: row.name,
          code: null,
          model: null,
          manufacturer: null,
          category: null,
          status: "documented",
          kind: "Fabricante",
          detail: null,
        }));
        const unique = new Map<string, TechnicalResult>();
        [...mappedComponents, ...mappedReferences, ...mappedEngines, ...mappedManufacturers].forEach((item) => {
          unique.set(`${item.kind}:${item.id}`, item);
        });
        if (active) setResults([...unique.values()]);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível consultar o catálogo técnico.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void runSearch();
    return () => { active = false; };
  }, [normalizedSearch]);

  const groupedResults = useMemo(() => results, [results]);

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="size-4" />
          <span>Base de consulta da oficina</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Central Técnica</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Consulte os cadastros existentes de bombas injetoras, bicos, motores, componentes e referências.
        </p>
      </header>

      <section className="space-y-2" aria-label="Busca técnica">
        <label htmlFor="technical-search" className="text-sm font-medium">Busca técnica</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="technical-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite código, fabricante, modelo ou componente"
            className="h-12 pl-10"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Digite pelo menos 2 caracteres. A busca consulta diretamente os cadastros técnicos existentes.
        </p>
      </section>

      {normalizedSearch.length < 2 ? (
        <section className="space-y-3" aria-labelledby="technical-areas-title">
          <h2 id="technical-areas-title" className="text-lg font-semibold">Áreas técnicas</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {areas.map((area) => {
              const Icon = area.icon;
              return (
                <article key={area.id} className="flex min-h-36 flex-col gap-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{area.title}</h3>
                    <p className="text-sm text-muted-foreground">{area.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Resultados da busca</h2>
            <span className="text-xs text-muted-foreground">{groupedResults.length} encontrados</span>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Consultando a base técnica...</p> : null}
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {!loading && !error && groupedResults.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum cadastro encontrado para esta busca.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {groupedResults.map((item) => (
              <article key={`${item.kind}:${item.id}`} className="space-y-2 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{item.kind}</span>
                  <span className={item.status === "documented" ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300" : "inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300"}>
                    {item.status === "documented" ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                    {statusLabel(item.status)}
                  </span>
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  {item.code ? <div><dt className="text-xs text-muted-foreground">Código / referência</dt><dd className="font-medium">{item.code}</dd></div> : null}
                  {item.model ? <div><dt className="text-xs text-muted-foreground">Modelo / família</dt><dd>{item.model}</dd></div> : null}
                  {item.manufacturer ? <div><dt className="text-xs text-muted-foreground">Fabricante</dt><dd>{item.manufacturer}</dd></div> : null}
                  {item.category ? <div><dt className="text-xs text-muted-foreground">Categoria</dt><dd>{item.category}</dd></div> : null}
                </dl>
                {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wrench className="size-3.5" />
        Registros pendentes de validação são identificados como tal e não devem ser tratados como informação confirmada.
      </p>
    </div>
  );
}
