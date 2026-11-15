import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, Boxes, Building2, CheckCircle2, ExternalLink, FileText,
  Gauge, Search, Wrench, AlertCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel/central-tecnica")({
  head: () => ({
    meta: [
      { title: "Central Técnica — Cleidson Diesel" },
      { name: "description", content: "Consulta técnica de fabricantes, motores, componentes, aplicações e documentos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CentralTecnicaPage,
});

type Row = Record<string, any>;
type Area = "tudo" | "bombas" | "bicos" | "common-rail" | "motores" | "pecas" | "documentos";

const AREAS: { id: Area; label: string }[] = [
  { id: "tudo", label: "Tudo" },
  { id: "bombas", label: "Bombas injetoras" },
  { id: "bicos", label: "Bicos injetores" },
  { id: "common-rail", label: "Common Rail" },
  { id: "motores", label: "Motores" },
  { id: "pecas", label: "Peças e componentes" },
  { id: "documentos", label: "Documentação" },
];

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function statusLabel(value: unknown) {
  const status = text(value);
  if (status === "documented") return "Documentado";
  if (status === "pending_validation") return "Pendente de validação";
  if (status === "request_required") return "Acesso mediante solicitação";
  if (status === "public") return "Acesso público";
  return status || "Sem classificação";
}

function Status({ value }: { value: unknown }) {
  const status = text(value);
  const documented = status === "documented" || status === "public";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${documented ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}>
      {statusLabel(value)}
    </span>
  );
}

function CentralTecnicaPage() {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<Area>("tudo");
  const [manufacturer, setManufacturer] = useState("all");
  const [category, setCategory] = useState("all");
  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["central-tecnica-readonly"],
    queryFn: async () => {
      const tables = [
        "technical_manufacturers",
        "technical_categories",
        "technical_engines",
        "technical_components",
        "technical_references",
        "technical_applications",
        "technical_documents",
      ] as const;
      const loadAllPages = async (table: string) => {
        const pageSize = 500;
        const rows: Row[] = [];
        for (let from = 0; ; from += pageSize) {
          let request = (supabase as any).from(table).select("*");
          if (table === "technical_manufacturers" || table === "technical_documents") {
            request = request.eq("is_active", true);
          }
          const result = await request.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
          if (result.error) throw result.error;
          rows.push(...(result.data ?? []));
          if (!result.data || result.data.length < pageSize) break;
        }
        return rows;
      };
      const results = await Promise.all(tables.map((table) => loadAllPages(table)));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      return Object.fromEntries(tables.map((table, index) => [table, results[index]?.data ?? []])) as Record<string, Row[]>;
    },
    staleTime: 60_000,
  });

  const data = query.data;
  const manufacturers = data?.technical_manufacturers ?? [];
  const categories = data?.technical_categories ?? [];
  const engines = data?.technical_engines ?? [];
  const components = data?.technical_components ?? [];
  const references = data?.technical_references ?? [];
  const applications = data?.technical_applications ?? [];
  const documents = data?.technical_documents ?? [];

  const manufacturerById = useMemo(() => new Map(manufacturers.map((item) => [item.id, item.name])), [manufacturers]);
  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const engineById = useMemo(() => new Map(engines.map((item) => [item.id, item])), [engines]);
  const componentById = useMemo(() => new Map(components.map((item) => [item.id, item])), [components]);
  const selectedPump = components.find((item) => item.id === selectedPumpId) ?? null;
  const pumpParts = selectedPump
    ? components.filter((item) => item.component_type === "pump_component" && item.model === selectedPump.model)
      .sort((a, b) => {
        const pa = Number((text(a.technical_notes).match(/Posi[cç][aã]o\s*:\s*(\d+)/i) || [])[1] || 999999);
        const pb = Number((text(b.technical_notes).match(/Posi[cç][aã]o\s*:\s*(\d+)/i) || [])[1] || 999999);
        return pa - pb;
      })
    : [];
  const selectedPumpDocuments = selectedPump ? documents.filter((item) => item.component_id === selectedPump.id) : [];
  const selectedPumpReferences = selectedPump ? references.filter((item) => item.component_id === selectedPump.id) : [];

  const q = search.trim().toLocaleLowerCase("pt-BR");
  const matches = (values: unknown[]) => !q || values.some((value) => text(value).toLocaleLowerCase("pt-BR").includes(q));

  const visibleEngines = engines.filter((item) =>
    (manufacturer === "all" || item.manufacturer_id === manufacturer) &&
    matches([item.family, item.model, item.engine_code, item.fuel_system, manufacturerById.get(item.manufacturer_id), item.technical_notes]) &&
    (area === "tudo" || area === "motores")
  );
  const visibleComponents = components.filter((item) =>
    (manufacturer === "all" || item.manufacturer_id === manufacturer) &&
    (category === "all" || item.category_id === category) &&
    matches([item.name, item.component_code, item.model, item.component_type, item.description, item.technical_notes, manufacturerById.get(item.manufacturer_id), categoryById.get(item.category_id)]) &&
    (area === "tudo" || area === "bombas" && /bomba|injetora|ve|vp/i.test(`${item.name} ${categoryById.get(item.category_id)}`) ||
      area === "bicos" && /bico|injetor/i.test(`${item.name} ${categoryById.get(item.category_id)}`) ||
      area === "common-rail" && /common rail|rail/i.test(`${item.name} ${item.description} ${categoryById.get(item.category_id)}`) ||
      area === "pecas")
  );
  const visibleDocuments = documents.filter((item) => {
    const engine = engineById.get(item.engine_id);
    const component = componentById.get(item.component_id);
    const documentManufacturerId = item.manufacturer_id || engine?.manufacturer_id || component?.manufacturer_id;
    return (manufacturer === "all" || documentManufacturerId === manufacturer) &&
      (category === "all" || component?.category_id === category) &&
      matches([item.title, item.document_type, item.source_name, item.notes, manufacturerById.get(documentManufacturerId), engine?.model, component?.name, categoryById.get(component?.category_id)]) &&
      (area === "tudo" || area === "documentos");
  });
  const visibleReferences = references.filter((item) => {
    const component = componentById.get(item.component_id);
    return (manufacturer === "all" || component?.manufacturer_id === manufacturer || item.reference_manufacturer_id === manufacturer) &&
      (category === "all" || component?.category_id === category) &&
      matches([item.reference_code, item.relation_type, item.source_description, item.notes, component?.name, manufacturerById.get(item.reference_manufacturer_id), categoryById.get(component?.category_id)]) &&
      (area === "tudo" || area === "pecas");
  });

  const visibleApplications = applications.filter((item) => {
    const engine = engineById.get(item.engine_id);
    const component = componentById.get(item.component_id);
    const applicationManufacturerMatches = manufacturer === "all" || component?.manufacturer_id === manufacturer || engine?.manufacturer_id === manufacturer;
    const linkedCategory = categoryById.get(component?.category_id) || "";
    const linkedComponent = component?.name || component?.component_type || "";
    const areaMatch =
      area === "tudo" ||
      (area === "bombas" && /bomba|injetora|\bve\b|\bvp\b/i.test(`${linkedComponent} ${linkedCategory}`)) ||
      (area === "bicos" && /bico|injetor/i.test(`${linkedComponent} ${linkedCategory}`)) ||
      (area === "common-rail" && /common rail|rail/i.test(`${linkedComponent} ${linkedCategory} ${engine?.fuel_system || ""}`));
    return applicationManufacturerMatches &&
      (category === "all" || component?.category_id === category) &&
      matches([item.equipment_type, item.equipment_manufacturer, item.equipment_model, item.application_notes, engine?.model, linkedComponent, linkedCategory, manufacturerById.get(component?.manufacturer_id || engine?.manufacturer_id)]) &&
      areaMatch;
  });

  const totalResults = visibleEngines.length + visibleComponents.length + visibleDocuments.length + visibleReferences.length + visibleApplications.length;
  const stats = [
    { label: "Fabricantes", value: manufacturers.length, icon: Building2 },
    { label: "Motores", value: engines.length, icon: Gauge },
    { label: "Componentes", value: components.length, icon: Boxes },
    { label: "Documentos", value: documents.length, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Consulta interna da oficina</p>
          <h1 className="flex items-center gap-2 text-3xl"><BookOpen className="size-7 text-primary" />Central Técnica</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Consulte informações cadastradas sobre fabricantes, motores, componentes, aplicações e documentação técnica.</p>
        </div>
        <span className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Somente consulta · sem edição</span>
      </div>

      {query.isLoading && <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">Carregando a base técnica…</div>}
      {query.isError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div><p className="font-medium">Não foi possível carregar a Central Técnica.</p><p className="mt-1 text-muted-foreground">Verifique sua conexão e as permissões de leitura do seu usuário.</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo da base técnica">
            {stats.map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div><Icon className="size-5 text-muted-foreground" /></div>)}
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar fabricante, motor, código, componente ou documento…" aria-label="Buscar na Central Técnica" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">Fabricante</span><select value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"><option value="all">Todos os fabricantes</option>{manufacturers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="text-muted-foreground">Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3"><option value="all">Todas as categorias</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Filtrar por área">
              {AREAS.map((item) => <Button key={item.id} type="button" size="sm" variant={area === item.id ? "default" : "outline"} onClick={() => setArea(item.id)}>{item.label}</Button>)}
            </div>
            <p className="text-xs text-muted-foreground">{totalResults} resultado(s) nas áreas exibidas. Os filtros não alteram os dados cadastrados.</p>
          </section>

          {selectedPump && (
            <section className="space-y-4 rounded-xl border-2 border-primary/30 bg-card p-4" aria-label="Detalhes do despiece">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Despiece da bomba</p>
                  <h2 className="text-xl font-semibold">{selectedPump.name}</h2>
                  <p className="text-sm text-muted-foreground">Bosch · Código {selectedPump.component_code || selectedPump.model}</p>
                  <div className="mt-2"><Status value={selectedPump.information_status} /></div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedPumpId(null)}>Fechar despiece</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-dashed border-border p-4">
                  <h3 className="font-semibold">Imagem do despiece</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Imagem original ainda não cadastrada. Não exibimos desenhos genéricos como se fossem o despiece confirmado desta bomba.</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <h3 className="font-semibold">Documentos e referências</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedPumpDocuments.length} documento(s) · {selectedPumpReferences.length} referência(s)</p>
                  {selectedPumpDocuments.map((doc) => <div key={doc.id} className="mt-2 text-sm">
                    <p className="font-medium">{doc.title}</p>
                    {doc.source_url && <a className="text-primary underline" href={doc.source_url} target="_blank" rel="noreferrer">Abrir fonte</a>}
                    <Status value={doc.information_status} />
                  </div>)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Peças do despiece</h3><span className="text-sm text-muted-foreground">{pumpParts.length} peças</span></div>
                {pumpParts.length ? <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-muted/60 text-left"><tr><th className="p-3">Posição</th><th className="p-3">Código</th><th className="p-3">Descrição</th><th className="p-3">Quantidade</th><th className="p-3">Status</th></tr></thead>
                    <tbody>{pumpParts.map((part) => {
                      const position = (text(part.technical_notes).match(/Posi[cç][aã]o\s*:\s*(\d+)/i) || [])[1] || "—";
                      return <tr key={part.id} className="border-t border-border">
                        <td className="p-3 font-semibold tabular-nums">{position}</td>
                        <td className="p-3 font-mono">{part.component_code || "—"}</td>
                        <td className="p-3">{part.name}<p className="mt-1 text-xs text-muted-foreground">Foto individual ainda não cadastrada</p></td>
                        <td className="p-3 text-muted-foreground">Não informada</td>
                        <td className="p-3"><Status value={part.information_status} /></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div> : <Empty text="Nenhuma peça vinculada a este modelo." />}
              </div>
              <p className="text-xs text-muted-foreground">As posições e descrições são exibidas conforme o cadastro existente. Quantidades e imagens não são presumidas.</p>
            </section>
          )}

          {(area === "tudo" || area === "motores") && <section className="space-y-3">
            <SectionTitle icon={<Gauge />} title="Motores" count={visibleEngines.length} />
            {visibleEngines.length ? <div className="grid gap-3 md:grid-cols-2">{visibleEngines.map((item) => <article key={item.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{item.family || item.model || "Motor sem identificação"}</h3><Status value={item.information_status} /></div>
              <p className="text-sm text-muted-foreground">{manufacturerById.get(item.manufacturer_id) || "Fabricante não informado"}{item.model ? ` · ${item.model}` : ""}</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">{item.engine_code && <Info label="Código" value={item.engine_code} />}{item.displacement && <Info label="Cilindrada" value={item.displacement} />}{item.fuel_system && <Info label="Sistema" value={item.fuel_system} />}{item.cylinder_configuration && <Info label="Configuração" value={item.cylinder_configuration} />}</dl>
              {item.technical_notes && <p className="border-t border-border pt-2 text-sm text-muted-foreground">{item.technical_notes}</p>}
              {item.component_type === "bomba_rotativa_ve" && <Button className="mt-2" size="sm" onClick={() => setSelectedPumpId(item.id)}>Abrir despiece <Boxes className="ml-2 size-4" /></Button>}
            </article>)}</div> : <Empty text="Nenhum motor corresponde aos filtros selecionados." />}
          </section>}

          {(area === "tudo" || ["bombas", "bicos", "common-rail", "pecas"].includes(area)) && <section className="space-y-3">
            <SectionTitle icon={<Wrench />} title="Componentes" count={visibleComponents.length} />
            {visibleComponents.length ? <div className="grid gap-3 md:grid-cols-2">{visibleComponents.map((item) => <article key={item.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{item.name}</h3><Status value={item.information_status} /></div>
              <p className="text-sm text-muted-foreground">{manufacturerById.get(item.manufacturer_id) || "Fabricante não informado"} · {categoryById.get(item.category_id) || item.component_type || "Categoria não informada"}</p>
              {item.component_code && <p className="text-sm"><span className="text-muted-foreground">Código: </span><strong>{item.component_code}</strong></p>}
              {item.model && <p className="text-sm"><span className="text-muted-foreground">Modelo: </span>{item.model}</p>}
              {item.description && <p className="text-sm">{item.description}</p>}
              {item.technical_notes && <p className="border-t border-border pt-2 text-sm text-muted-foreground">{item.technical_notes}</p>}
            </article>)}</div> : <Empty text="Ainda não há componentes cadastrados para esta seleção. Não exibimos informações presumidas como se fossem validadas." />}
          </section>}

          {(area === "tudo" || area === "pecas") && <section className="space-y-3">
            <SectionTitle icon={<Boxes />} title="Referências de peças" count={visibleReferences.length} />
            {visibleReferences.length ? <div className="divide-y divide-border rounded-lg border border-border bg-card">{visibleReferences.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">{item.reference_code}</p><p className="text-sm text-muted-foreground">{componentById.get(item.component_id)?.name || "Componente não informado"} · {manufacturerById.get(item.reference_manufacturer_id) || "Fabricante não informado"}</p><p className="mt-1 text-xs text-muted-foreground">{item.relation_type || "Relação não classificada"}</p></div><Status value={item.information_status} /></div>)}</div> : <Empty text="Nenhuma referência de peça foi cadastrada até o momento." />}
          </section>}

          {(area === "tudo" || area === "documentos") && <section className="space-y-3">
            <SectionTitle icon={<FileText />} title="Documentação técnica" count={visibleDocuments.length} />
            {visibleDocuments.length ? <div className="divide-y divide-border rounded-lg border border-border bg-card">{visibleDocuments.map((item) => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1"><h3 className="font-semibold">{item.title}</h3><p className="text-sm text-muted-foreground">{manufacturerById.get(item.manufacturer_id) || "Fabricante não informado"}{item.source_name ? ` · ${item.source_name}` : ""}{item.document_type ? ` · ${item.document_type}` : ""}</p>{item.notes && <p className="text-sm">{item.notes}</p>}<div className="flex flex-wrap gap-2 pt-1"><Status value={item.information_status} /><Status value={item.access_type} /></div></div>
              {item.source_url && <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">Abrir fonte <ExternalLink className="size-3.5" /></a>}
            </article>)}</div> : <Empty text="Nenhum documento corresponde aos filtros selecionados." />}
          </section>}

          {(area === "tudo" || area === "bombas" || area === "bicos" || area === "common-rail") && (
            <section className="space-y-3">
              <SectionTitle icon={<CheckCircle2 />} title="Aplicações cadastradas" count={visibleApplications.length} />
              {visibleApplications.length ? <div className="divide-y divide-border rounded-lg border border-border bg-card">{visibleApplications.map((item) => <div key={item.id} className="p-4"><p className="font-medium">{[item.equipment_manufacturer, item.equipment_model].filter(Boolean).join(" ") || item.equipment_type || "Aplicação sem identificação"}</p><p className="text-sm text-muted-foreground">{item.equipment_type || "Equipamento"}{item.year_start ? ` · ${item.year_start}${item.year_end ? `–${item.year_end}` : "+"}` : ""}</p>{item.application_notes && <p className="mt-1 text-sm">{item.application_notes}</p>}<p className="mt-1 text-xs text-muted-foreground">{item.information_status ? statusLabel(item.information_status) : "Status não informado"}</p></div>)}</div> : <Empty text="Nenhuma aplicação cadastrada corresponde à busca." />}
            </section>
          )}

          <p className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><AlertCircle className="size-4 shrink-0" />Informações pendentes de validação estão identificadas. Documentos com acesso mediante solicitação devem ser obtidos diretamente com a fonte responsável.</p>
        </>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-xl font-semibold">{icon}<span>{title}</span></h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground">{count}</span></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
