import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, BookOpen, Boxes, Fuel, Gauge, Search, Wrench } from "lucide-react";

import { Input } from "@/components/ui/input";

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
    description: "Identificação de modelos, componentes principais, referências e despiece.",
    icon: Fuel,
    terms: "bomba injetora diesel modelo fabricante despiece componentes referência",
  },
  {
    id: "bicos",
    title: "Bicos injetores",
    description: "Identificação, componentes, testes e calibração.",
    icon: Gauge,
    terms: "bico injetor diesel teste calibração estanqueidade pré-injeção retorno",
  },
  {
    id: "common-rail",
    title: "Common Rail",
    description: "Bombas de alta pressão, injetores, sensores e atuadores.",
    icon: Boxes,
    terms: "common rail bomba alta pressão injetor sensor atuador",
  },
] as const;

function CentralTecnicaPage() {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredAreas = useMemo(() => {
    if (!normalizedSearch) return areas;
    return areas.filter((area) =>
      `${area.title} ${area.description} ${area.terms}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
    );
  }, [normalizedSearch]);

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="size-4" />
          <span>Base de consulta da oficina</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Central Técnica</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Consulte informações técnicas de bombas injetoras, bicos injetores e sistemas Common Rail.
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
            placeholder="Código, fabricante, modelo ou componente"
            className="h-12 pl-10"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          A busca nesta etapa filtra as áreas disponíveis. A consulta ao catálogo técnico será conectada após a confirmação da origem e das permissões dos dados.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="technical-areas-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="technical-areas-title" className="text-lg font-semibold">Áreas técnicas</h2>
          <span className="text-xs text-muted-foreground">{filteredAreas.length} áreas</span>
        </div>
        {filteredAreas.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {filteredAreas.map((area) => {
              const Icon = area.icon;
              return (
                <article key={area.id} className="flex min-h-44 flex-col gap-3 rounded-lg border border-border bg-card p-4">
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
        ) : (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma área corresponde à busca. Tente outro termo.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-warning/40 bg-warning/5 p-4" aria-label="Estado da base técnica">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="space-y-1">
            <h2 className="font-medium">Catálogo técnico ainda não conectado</h2>
            <p className="text-sm text-muted-foreground">
              Esta primeira etapa cria a entrada da nova Central. Nenhum código, componente, aplicação ou sequência de montagem será exibido como confirmado até a conexão com a base técnica correta.
            </p>
          </div>
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wrench className="size-3.5" />
        Informações técnicas devem ser identificadas como documentadas, pendentes de validação ou experiência da oficina.
      </p>
    </div>
  );
}
