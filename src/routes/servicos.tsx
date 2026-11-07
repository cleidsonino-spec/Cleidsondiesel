import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Check } from "lucide-react";

import { PageHeading, PublicLayout } from "@/components/site/public-layout";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/services";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Cleidson Diesel" },
      {
        name: "description",
        content: "Bomba injetora, bicos injetores, Common Rail, teste em bancada e diagnóstico diesel.",
      },
      { property: "og:title", content: "Serviços — Cleidson Diesel" },
      { property: "og:description", content: "Tudo em injeção diesel: bomba, bicos, Common Rail e bancada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ServicosPage,
});

const signs = [
  "Fumaça preta ou branca em excesso",
  "Perda de força e consumo alto",
  "Dificuldade para pegar",
  "Motor falhando ou batendo",
  "Luz de injeção acesa",
];

function ServicosPage() {
  return (
    <PublicLayout>
      <PageHeading eyebrow="Especialidade" title="Serviços">
        Trabalhamos com sistemas mecânicos e eletrônicos de injeção diesel para carros,
        caminhonetes, caminhões e máquinas.
      </PageHeading>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-4 md:grid-cols-2">
          {SERVICES.map((s, i) => (
            <div key={s.title} className="flex gap-5 rounded-md border border-border bg-card p-6 shadow-card">
              <span className="font-display text-3xl text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="text-xl">{s.title}</h2>
                <p className="mt-2 text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-8 rounded-md border border-border bg-card/60 p-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl md:text-3xl">Sinais de problema na injeção</h2>
            <p className="mt-3 text-muted-foreground">Percebeu algum desses? Agende uma avaliação.</p>
            <Button asChild size="lg" className="mt-6">
              <Link to="/agendar">
                <CalendarCheck /> Agendar avaliação
              </Link>
            </Button>
          </div>
          <ul className="space-y-3">
            {signs.map((s) => (
              <li key={s} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-sm bg-primary/20">
                  <Check className="size-4 text-primary" />
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}
