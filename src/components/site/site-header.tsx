import { Link } from "@tanstack/react-router";
import { Menu, Wrench, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "./logo";

const links = [
  { to: "/", label: "Início" },
  { to: "/servicos", label: "Serviços" },
  { to: "/agendar", label: "Agendar" },
  { to: "/consulta", label: "Consultar placa" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: true }}
            >
              {l.label}
            </Link>
          ))}
          <Button asChild size="sm" variant="outline" className="ml-2">
            <Link to="/painel">
              <Wrench /> Painel
            </Link>
          </Button>
        </nav>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-display uppercase">Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-4 flex flex-col gap-1 px-4">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-sm px-3 py-3 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                  activeOptions={{ exact: true }}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                to="/painel"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center gap-2 rounded-sm border border-border px-3 py-3 text-base font-medium"
              >
                <Wrench className="size-4" /> Painel da oficina
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
