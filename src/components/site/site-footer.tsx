import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 print:hidden">
      <div className="hazard h-1.5 opacity-80" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Especialistas em bomba injetora, bicos e sistemas de injeção diesel.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-display uppercase">Atendimento</p>
          <p className="text-muted-foreground">Seg a sex · 08h às 18h</p>
          <p className="text-muted-foreground">Sábado · 08h às 12h</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-display uppercase">Acesso rápido</p>
          <Link to="/agendar" className="text-muted-foreground hover:text-foreground">
            Agendar serviço
          </Link>
          <Link to="/consulta" className="text-muted-foreground hover:text-foreground">
            Consultar meu veículo
          </Link>
          <Link to="/painel" className="text-muted-foreground hover:text-foreground">
            Painel da oficina
          </Link>
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Cleidson Diesel
      </p>
    </footer>
  );
}
