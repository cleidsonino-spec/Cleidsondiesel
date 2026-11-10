import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Car, Users, ShieldCheck, ClipboardList, Download, ExternalLink, LogOut, Plus, ShieldAlert } from "lucide-react";

import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Cleidson Diesel" },
      { name: "description", content: "Ordens de serviço e agendamentos da oficina." },
      { property: "og:title", content: "Painel — Cleidson Diesel" },
      { property: "og:description", content: "Painel interno da oficina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    return { isAdmin: data === true };
  },
  component: PainelLayout,
});

function PainelLayout() {
  const { isAdmin, user } = Route.useRouteContext();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo />
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <a
                href="https://github.com/cleidsonino-spec/Cleidsondiesel/releases/latest/download/cleidson-diesel.apk"
                aria-label="Baixar aplicativo Cleidson Diesel para Android"
              >
                <Download /> <span className="hidden sm:inline">Baixar aplicativo</span>
                <span className="sm:hidden">App</span>
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/">
                <ExternalLink /> Ver site
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair">
              <LogOut /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
        {isAdmin && (
          <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2">
            <PanelLink to="/painel" icon={<ClipboardList />} label="Ordens de serviço" exact />
            <PanelLink to="/painel/agendamentos" icon={<CalendarDays />} label="Agendamentos" />
            <PanelLink to="/painel/clientes" icon={<Users />} label="Clientes" />
            <PanelLink to="/painel/veiculos" icon={<Car />} label="Veículos" />
            <PanelLink to="/painel/garantias" icon={<ShieldCheck />} label="Garantias" />
            <Button asChild size="sm" className="ml-auto shrink-0">
              <Link to="/painel/ordens/nova" search={{}}>
                <Plus /> Nova OS
              </Link>
            </Button>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {isAdmin ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-md rounded-md border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto size-10 text-warning" />
            <h1 className="mt-4 text-xl">Acesso aguardando liberação</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A conta <strong className="text-foreground">{user.email}</strong> não tem permissão para
              acessar o painel. Somente a conta administradora da oficina pode entrar.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function PanelLink({
  to,
  icon,
  label,
  exact,
}: {
  to: "/painel" | "/painel/agendamentos" | "/painel/clientes" | "/painel/veiculos" | "/painel/garantias";
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      className="flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4"
      activeProps={{ className: "bg-secondary text-foreground" }}
    >
      {icon}
      {label}
    </Link>
  );
}
