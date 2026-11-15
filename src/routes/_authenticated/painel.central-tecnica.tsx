import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, BookOpen, Boxes, CheckCircle2, Fuel, Gauge, Search, Wrench } from "lucide-react";

import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { normalizePumpReference, matchesPumpReference } from "@/lib/technical-reference";

export const Route = createFileRoute("/_authenticated/painel/central-tecnica")({
  head: () => ({ meta: [
    { title: "Central Técnica — Cleidson Diesel" },
    { name: "description", content: "Consulta técnica de bombas injetoras, bicos injetores e sistemas Common Rail." },
    { name: "robots", content: "noindex" },
  ] }),
  component: CentralTecnicaPage,
});

const areas = [
  {
    id: "bombas",
    title: "Bombas injetoras",
    description: "Bombas em linha, rotativas VE e outros modelos cadastrados.",
    icon: Fuel,
    categoryIds: [
      "d40982ec-2f50-41d7-8d8b-7718a36232f7",
      "a11ea631-fbfa-41ef-8742-adef242f410c",
      "d5f8206a-1002-43e8-bc62-f000fa256ee1",
      "2d05ad12-1fe2-4bba-97e1-a5e5628af23e",
    ],
  },
  {
    id: "bicos",
    title: "Bicos injetores",
    description: "Bicos mecânicos e conjuntos injetores cadastrados.",
    icon: Gauge,
    categoryIds: [
      "cf766f5e-93fa-4845-9351-3bfb8dcc7846",
      "405610f8-ecf5-4f98-a0e1-8ce9be13ccb6",
      "0873ba46-0ff2-48c2-898f-716242996a6b",
      "8111033a-905e-4ede-8da0-81c8c407c3b5",
    ],
  },
  {
    id: "common-rail",
    title: "Sistema Common Rail",
    description: "Bombas de alta pressão, injetores, rail e componentes do sistema.",
    icon: Boxes,
    categoryIds: [
      "5fcfa32a-2385-46ec-86fc-5570547fb616",
      "c33c6f15-bd6d-4c42-bbd0-4dba6c389211",
      "744003e3-c98b-406d-9e3e-664a3a34cbbf",
      "ed6944d6-20e5-47fa-b94b-827dbda4d8ed",
      "7a5a1c18-cac9-41ad-b20a-38db419fa855",
      "d8a84d98-191c-4f03-b201-0a1cba74cb60",
    ],
  },
] as const;

type TechnicalResult = {
  id: string;
  title: string;
  code: string | null;
  model: string | null;
  manufacturer: string | null;
  category: string | null;
  status: string;
  kind: "Componente";
  detail: string | null;
  position: string | null;
  quantity: string | null;
};



function catalogMetadata(notes: string | null) {
  return {
    position: notes?.match(/Posição(?: no catálogo)?\s*:?\s*([^;|\n]+)/i)?.[1]?.trim() ?? null,
    quantity: notes?.match(/Quantidade(?: indicada)?\s*:?\s*([^;|\n]+)/i)?.[1]?.trim() ?? null,
  };
}

function statusLabel(status: string) {
  if (status === "documented") return "Documentado";
  if (status === "pending_validation") return "Pendente de validação";
  return status || "Status não informado";
}

function positionSortValue(position: string | null) {
  const match = position?.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function CentralTecnicaPage() {
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<(typeof areas)[number]["id"]>("bombas");
  const [pumpFamily, setPumpFamily] = useState<"todas" | "ve">("todas");
  const [pumpReference, setPumpReference] = useState("");
  const [results, setResults] = useState<TechnicalResult[]>([]);
  const [identifiedPump, setIdentifiedPump] = useState<{ id: string; name: string; code: string; model: string | null; description: string | null; status: string } | null>(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedSearch = search.trim();
  const normalizedPumpReference = pumpReference.trim();
  const normalizedPumpReferenceDigits = normalizePumpReference(normalizedPumpReference);

  const activeArea = areas.find((area) => area.id === selectedArea) ?? areas[0];
  const activeCategoryIds = selectedArea === "bombas" && pumpFamily === "ve"
    ? ["d5f8206a-1002-43e8-bc62-f000fa256ee1"]
    : [...activeArea.categoryIds];

  useEffect(() => {
    let active = true;
    if (selectedArea === "bombas" && pumpFamily === "ve") {
      setResults([]);
      setIdentifiedPump(null);
      setError(null);
      if (normalizedPumpReferenceDigits.length !== 10) {
        setLoading(false);
        return () => { active = false; };
      }
      const loadPumpParts = async () => {
        setLoading(true);
        try {
          // Primeiro identifica a bomba completa pelo código Bosch; depois consulta
          // exclusivamente as referências relacionadas ao component_id encontrado.
          const { data: pumps, error: pumpError } = await (supabase as any)
            .from("technical_components")
            .select("id,name,component_code,model,description,information_status")
            .eq("category_id", "d5f8206a-1002-43e8-bc62-f000fa256ee1")
            .eq("component_type", "bomba_rotativa_ve_modelo")
            .limit(500);
          if (pumpError) throw pumpError;
          const matchedPumps = (pumps ?? []).filter((pump: any) =>
            matchesPumpReference(pump.component_code, normalizedPumpReferenceDigits)
          );
          if (matchedPumps.length !== 1) {
            if (active) {
              setResults([]);
              setError(matchedPumps.length > 1
                ? "Mais de uma bomba possui essa referência. O cadastro precisa ser revisado antes da consulta."
                : "Bomba não encontrada. Confira a referência Bosch completa.");
            }
            return;
          }
          const pump = matchedPumps[0];
          if (active) setIdentifiedPump({ id: pump.id, name: pump.name, code: pump.component_code, model: pump.model, description: pump.description, status: pump.information_status });
          const { data: references, error: referencesError } = await (supabase as any)
            .from("technical_references")
            .select("id,reference_code,relation_type,information_status,source_description,source_url,notes")
            .eq("component_id", pump.id)
            .order("reference_code", { ascending: true });
          if (referencesError) throw referencesError;

          const mapped: TechnicalResult[] = (references ?? []).map((reference: any) => {
            const metadata = catalogMetadata(reference.notes);
            const designation = reference.notes?.match(/designação traduzida\s*:\s*([^.|\n]+)/i)?.[1]?.trim();
            return {
              id: reference.id,
              title: designation || reference.source_description || "Referência técnica sem descrição",
              code: reference.reference_code,
              model: pump.model,
              manufacturer: "Bosch",
              category: reference.relation_type,
              status: reference.information_status,
              kind: "Componente",
              detail: reference.notes ?? reference.source_description ?? null,
              ...metadata,
            };
          });
          if (active) {
            setResults(mapped);
            if (mapped.length === 0) {
              setError("A bomba foi localizada, mas ainda não possui referências de peças vinculadas.");
            }
          }
        } catch (cause) {
          if (active) setError(cause instanceof Error ? cause.message : "Não foi possível localizar as peças desta referência.");
        } finally {
          if (active) setLoading(false);
        }
      };
      void loadPumpParts();
      return () => { active = false; };
    }
    if (normalizedSearch.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return () => { active = false; };
    }

    const runSearch = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await (supabase as any)
          .from("technical_components")
          .select("id,name,component_code,model,description,technical_notes,information_status,technical_manufacturers(name),technical_categories(name)")
          .in("category_id", activeCategoryIds)
          .or(`name.ilike.%${normalizedSearch}%,component_code.ilike.%${normalizedSearch}%,model.ilike.%${normalizedSearch}%`)
          .limit(40);

        if (queryError) throw queryError;
        const mapped: TechnicalResult[] = (data ?? []).map((row: any) => ({
          id: row.id,
          title: row.name,
          code: row.component_code,
          model: row.model,
          manufacturer: row.technical_manufacturers?.name ?? null,
          category: row.technical_categories?.name ?? null,
          status: row.information_status,
          kind: "Componente",
          detail: [row.description, row.technical_notes].filter(Boolean).join(" "),
          ...catalogMetadata(row.technical_notes),
        }));
        if (active) setResults(mapped);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível consultar o catálogo técnico.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void runSearch();
    return () => { active = false; };
  }, [normalizedSearch, normalizedPumpReference, activeArea, pumpFamily, selectedArea]);

  const groupedResults = useMemo(() => results, [results]);
  const positionIndex = useMemo(
    () => [...results].filter((item) => item.position).sort((a, b) =>
      positionSortValue(a.position) - positionSortValue(b.position) ||
      String(a.position).localeCompare(String(b.position), "pt-BR", { numeric: true }) ||
      String(a.code).localeCompare(String(b.code))
    ),
    [results]
  );

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="size-4" />
          <span>Base de consulta da oficina</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Central Técnica</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Consulte somente bombas injetoras, bicos injetores e sistemas Common Rail.
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
            placeholder="Digite código, modelo ou nome do componente"
            className="h-12 pl-10"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Digite pelo menos 2 caracteres. A busca consulta somente a área selecionada no catálogo técnico.
        </p>
      </section>

      {selectedArea === "bombas" ? (
        <section className="flex flex-wrap items-center gap-2" aria-label="Família de bombas">
          <span className="text-sm font-medium">Família:</span>
          <button type="button" onClick={() => { setPumpFamily("todas"); setSearch(""); setPumpReference(""); }} aria-pressed={pumpFamily === "todas"} className={`rounded-full border px-3 py-1.5 text-sm ${pumpFamily === "todas" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Todas as bombas</button>
          <button type="button" onClick={() => { setPumpFamily("ve"); setSearch(""); setPumpReference(""); }} aria-pressed={pumpFamily === "ve"} className={`rounded-full border px-3 py-1.5 text-sm ${pumpFamily === "ve" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Rotativa VE</button>
        </section>
      ) : null}

      {selectedArea === "bombas" && pumpFamily === "ve" ? (
        <section className="space-y-2" aria-label="Identificar bomba rotativa VE">
          <label htmlFor="pump-reference" className="text-sm font-medium">Referência da bomba injetora</label>
          <Input id="pump-reference" value={pumpReference} onChange={(event) => setPumpReference(event.target.value)} placeholder="Digite a referência Bosch, ex.: 0 460 424 232" className="h-12" />
          <p className="text-xs text-muted-foreground">Informe a referência Bosch completa com 10 números. Só exibiremos peças vinculadas exatamente a essa referência.</p>
        </section>
      ) : null}

      {selectedArea === "bombas" && pumpFamily === "ve" ? (
        <section className="space-y-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Peças da bomba identificada</h2>
            <span className="text-xs text-muted-foreground">{groupedResults.length} peças</span>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Localizando a referência e suas peças...</p> : null}
          {error ? <div className="rounded-md border border-destructive/30 p-4 text-sm text-destructive">{error}</div> : null}
          {!loading && !error && normalizedPumpReferenceDigits.length === 10 && groupedResults.length === 0 ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma peça ou kit específico foi localizado para esta referência. Não exibiremos peças genéricas como se fossem deste modelo.</div> : null}
          {identifiedPump ? (
            <article className="space-y-3 rounded-lg border border-primary/30 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Bomba identificada</h3>
                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">{statusLabel(identifiedPump.status)}</span>
              </div>
              <p className="font-medium">{identifiedPump.name}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Referência Bosch</dt><dd>{identifiedPump.code}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Modelo</dt><dd>{identifiedPump.model ?? "Não informado"}</dd></div>
              </dl>
              {identifiedPump.description ? <p className="text-xs text-muted-foreground">{identifiedPump.description}</p> : null}
              <div className="space-y-2 border-t pt-3">
                <div>
                  <h4 className="text-sm font-semibold">Figura explodida — catálogo Bosch 2009/2010, página 110</h4>
                  <p className="text-xs text-muted-foreground">Documento vinculado a esta bomba. A figura é compartilhada com outras referências do catálogo; confirme sempre o código da bomba e a tabela de peças antes de usar na montagem.</p>
                </div>
                <div className="overflow-hidden rounded-md border bg-white">
                  <iframe
                    src="https://images.canaldapeca.com.br/catalogos/Bosch_catalogo_catalogo_bombas_ve_2009_2010.pdf#page=110&zoom=175"
                    title="Figura explodida Bosch — página 110 do catálogo VE"
                    className="h-[920px] w-full bg-white"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://images.canaldapeca.com.br/catalogos/Bosch_catalogo_catalogo_bombas_ve_2009_2010.pdf#page=110"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Abrir página 110 do catálogo completo
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">Visualização da página original do catálogo Bosch. A figura é compartilhada por várias referências; os códigos e quantidades devem ser conferidos na tabela específica da bomba. Os pontos clicáveis serão adicionados após validação das posições.</p>
              </div>
            </article>
          ) : null}
          {identifiedPump && positionIndex.length > 0 ? (
            <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="Índice de posições do catálogo">
              <div className="space-y-1">
                <h3 className="font-semibold">Índice de posições do catálogo</h3>
                <p className="text-xs text-muted-foreground">Selecione uma posição para localizar a ficha correspondente abaixo. Este índice é textual; os pontos sobre a imagem serão incluídos somente após conferência das coordenadas no desenho original.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {positionIndex.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedReferenceId(item.id)}
                    aria-pressed={selectedReferenceId === item.id}
                    className={`rounded-md border p-3 text-left transition-colors hover:border-primary ${selectedReferenceId === item.id ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border"}`}
                  >
                    <span className="block text-xs text-muted-foreground">Posição {item.position}</span>
                    <span className="block text-sm font-semibold">{item.code}</span>
                    <span className="block text-xs text-muted-foreground">{item.quantity ? `Quantidade: ${item.quantity}` : "Quantidade não informada"}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {groupedResults.map((item) => (
              <article key={`${item.kind}:${item.id}`} className={`space-y-2 rounded-lg border bg-card p-4 ${selectedReferenceId === item.id ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Peça</span><span className="text-xs text-muted-foreground">{statusLabel(item.status)}</span></div>
                {selectedReferenceId === item.id ? <p className="text-xs font-medium text-primary">Selecionada no índice de posições</p> : null}
                <h3 className="font-semibold">{item.title}</h3>
                {item.code ? <p className="text-sm"><span className="text-muted-foreground">Código:</span> {item.code}</p> : null}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {item.position ? <span>Posição: {item.position}</span> : null}
                  {item.quantity ? <span>Quantidade: {item.quantity}</span> : null}
                </div>
                {item.model ? <p className="text-xs text-muted-foreground">{item.model}</p> : null}
                {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : normalizedSearch.length < 2 ? (
        <section className="space-y-3" aria-labelledby="technical-areas-title">
          <h2 id="technical-areas-title" className="text-lg font-semibold">Escolha uma área técnica</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {areas.map((area) => {
              const Icon = area.icon;
              return (
                <button type="button" key={area.id} onClick={() => { setSelectedArea(area.id); setSearch(""); }} aria-pressed={selectedArea === area.id} className={`flex min-h-36 flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary ${selectedArea === area.id ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                  <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{area.title}</h3>
                    <p className="text-sm text-muted-foreground">{area.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{activeArea.title}{selectedArea === "bombas" && pumpFamily === "ve" ? " — Rotativa VE" : ""}</h2>
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
        A consulta fica limitada à área selecionada. Registros pendentes de validação não são apresentados como informação confirmada.
      </p>
    </div>
  );
}
