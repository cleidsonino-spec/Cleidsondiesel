import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, Gauge, Search, ShieldCheck, Wrench } from "lucide-react";

import heroImg from "@/assets/hero-bomba-injetora.jpg";
import { PublicLayout } from "@/components/site/public-layout";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/services";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cleidson Diesel — Oficina de bomba injetora" },
      {
        name: "description",
        content:
          "Revisão de bomba injetora, bicos e Common Rail. Agende online e acompanhe o serviço pela placa do veículo.",
      },
      { property: "og:title", content: "Cleidson Diesel — Oficina de bomba injetora" },
      {
        property: "og:description",
        content: "Agende online e acompanhe o serviço do seu diesel pela placa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="Bomba injetora diesel desmontada na bancada"
          width={1600}
          height={1008}
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-side" />
        <div className="absolute inset-0 -z-10 bg-gradient-fade" />
        <div className="mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 md:justify-center md:pb-24">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-sm border border-primary/50 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-glow">
            <Gauge className="size-3.5" /> Especialistas em injeção diesel
          </p>
          <h1 className="max-w-3xl text-5xl sm:text-6xl md:text-7xl">
            Sua bomba injetora <span className="text-primary">no ponto certo.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Revisão, calibração em bancada e diagnóstico completo. Agende pelo site e
            acompanhe o serviço pela placa do veículo.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 bg-gradient-primary text-base shadow-glow">
              <Link to="/agendar">
                <CalendarCheck /> Agendar serviço
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 bg-background/40 text-base backdrop-blur">
              <Link to="/consulta">
                <Search /> Consultar pela placa
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="hazard h-2" />

      {/* Serviços */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">O que fazemos</p>
            <h2 className="text-3xl md:text-5xl">Serviços</h2>
          </div>
          <Link to="/servicos" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Ver todos <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <div key={s.title} className="group bg-card p-6 transition-colors hover:bg-secondary">
              <span className="font-display text-sm text-primary">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-y border-border/60 bg-card/50 steel-grid">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          {[
            { icon: CalendarCheck, t: "1. Agende", d: "Escolha o dia e horário disponível para trazer o veículo." },
            { icon: Wrench, t: "2. Diagnóstico", d: "Abrimos a ordem de serviço e avaliamos o sistema de injeção." },
            { icon: ShieldCheck, t: "3. Acompanhe", d: "Consulte o andamento pela placa até a hora da retirada." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-sm border border-primary/40 bg-primary/10">
                <Icon className="size-5 text-primary" />
              </span>
              <div>
                <h3 className="text-lg">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="relative overflow-hidden rounded-md bg-gradient-primary p-8 shadow-glow md:p-12">
          <h2 className="max-w-2xl text-3xl text-primary-foreground md:text-5xl">
            Motor falhando, fumaçando ou sem força?
          </h2>
          <p className="mt-3 max-w-xl text-primary-foreground/85">
            Pode ser a bomba ou os bicos. Traga para uma avaliação.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6 h-12 text-base">
            <Link to="/agendar">
              Agendar agora <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
