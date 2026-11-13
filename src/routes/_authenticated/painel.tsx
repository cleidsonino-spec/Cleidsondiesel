import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Car, Users, UserCog, ShieldCheck, ClipboardList, Download, ExternalLink, FileText, LogOut, Plus, ShieldAlert, Wallet, Receipt, ClipboardCheck, Menu } from "lucide-react";

import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/painel/notifications";
import { startStaffPushNotifications, unregisterAdminPushDevice } from "@/lib/push-notifications";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
    const { data, error } = await (supabase as any).from("user_roles")
      .select("role,is_active").eq("user_id", context.user.id);
    if (error) throw error;
    const rows = data ?? [];
    const roles = rows.filter((item: any) => item.is_active !== false).map((item: any) => item.role);
    const hasInactiveStaffRole = rows.some((item: any) =>
      item.is_active === false && ["mecanico", "secretaria"].includes(item.role)
    );
    const hasActiveStaffRole = rows.some((item: any) =>
      item.is_active !== false && ["admin", "secretaria", "mecanico"].includes(item.role)
    );
    if (hasInactiveStaffRole && !hasActiveStaffRole) {
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth" });
    }
    return { isAdmin: roles.includes("admin"), isSecretary: roles.includes("secretaria") };
  },
  component: PainelLayout,
});

function PainelLayout() {
  const { isAdmin, isSecretary, user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin && !isSecretary) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void startStaffPushNotifications().then((cleanup) => {
      if (cancelled) cleanup();
      else stop = cleanup;
    }).catch(() => console.error("[Push] Falha ao iniciar notificações."));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [isAdmin, isSecretary]);

  async function signOut() {
    try { await unregisterAdminPushDevice(); } catch { /* O encerramento da sessão não deve depender da rede. */ }
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
              <a href="https://github.com/cleidsonino-spec/Cleidsondiesel/releases/latest/download/cleidson-diesel.apk" aria-label="Baixar aplicativo Cleidson Diesel para Android">
                <Download /> <span className="hidden sm:inline">Baixar aplicativo</span><span className="sm:hidden">App</span>
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/"><ExternalLink /> Ver site</Link></Button>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair"><LogOut /> <span className="hidden sm:inline">Sair</span></Button>
            {(isAdmin || isSecretary) && (
              <div className="md:hidden">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Abrir menu do painel"><Menu /></Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[min(88vw,22rem)] overflow-y-auto">
                    <SheetHeader className="text-left">
                      <SheetTitle>Cleidson Diesel</SheetTitle>
                      <SheetDescription>Acesso rápido às áreas do painel.</SheetDescription>
                    </SheetHeader>
                    <nav className="mt-6 grid gap-1">
                      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operação</p>
                      <SheetClose asChild><PanelLink to="/painel" icon={<ClipboardList />} label="Visão geral" exact /></SheetClose>
                      <SheetClose asChild><PanelLink to="/painel/agendamentos" icon={<CalendarDays />} label="Agendamentos" /></SheetClose>
                      <SheetClose asChild><PanelLink to="/painel/orcamentos" icon={<FileText />} label="Orçamentos" /></SheetClose>
                      <SheetClose asChild><PanelLink to="/painel/relatorios" icon={<ClipboardCheck />} label="Relatórios" /></SheetClose>
                      <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cadastros</p>
                      <SheetClose asChild><PanelLink to="/painel/clientes" icon={<Users />} label="Clientes" /></SheetClose>
                      {isAdmin && <SheetClose asChild><PanelLink to="/painel/funcionarios" icon={<UserCog />} label="Funcionário" /></SheetClose>}
                      {isAdmin && <SheetClose asChild><PanelLink to="/painel/veiculos" icon={<Car />} label="Veículos" /></SheetClose>}
                      <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gestão</p>
                      {isAdmin && <SheetClose asChild><PanelLink to="/painel/garantias" icon={<ShieldCheck />} label="Garantias" /></SheetClose>}
                      {isAdmin && <SheetClose asChild><PanelLink to="/painel/financeiro" icon={<Wallet />} label="Financeiro" /></SheetClose>}
                      <SheetClose asChild><PanelLink to="/painel/cobrancas" icon={<Receipt />} label="Cobranças" /></SheetClose>
                      {isAdmin && <div className="px-3 py-2"><NotificationBell /></div>}
                      <SheetClose asChild>
                        <Link to="/painel/ordens/nova" search={{}} className="mt-4 flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                          <Plus className="size-4" /> Nova ordem de serviço
                        </Link>
                      </SheetClose>
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>
            )}
          </div>
        </div>
        {(isAdmin || isSecretary) && (
          <nav className="mx-auto hidden max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2 md:flex">
            <PanelLink to="/painel" icon={<ClipboardList />} label="Visão geral" exact />
            <PanelLink to="/painel/agendamentos" icon={<CalendarDays />} label="Agendamentos" />
            {(isAdmin || isSecretary) && <PanelLink to="/painel/orcamentos" icon={<FileText />} label="Orçamentos" />}
            {(isAdmin || isSecretary) && <PanelLink to="/painel/relatorios" icon={<ClipboardCheck />} label="Relatórios" />}
            <PanelLink to="/painel/clientes" icon={<Users />} label="Clientes" />
            {isAdmin && <PanelLink to="/painel/funcionarios" icon={<UserCog />} label="Funcionário" />}
            {isAdmin && <PanelLink to="/painel/veiculos" icon={<Car />} label="Veículos" />}
            {isAdmin && <PanelLink to="/painel/garantias" icon={<ShieldCheck />} label="Garantias" />}
            {isAdmin && <PanelLink to="/painel/financeiro" icon={<Wallet />} label="Financeiro" /> }
            {(isAdmin || isSecretary) && <PanelLink to="/painel/cobrancas" icon={<Receipt />} label="Cobranças" /> }
            {isAdmin && <NotificationBell />}
            <Button asChild size="sm" className="ml-auto shrink-0"><Link to="/painel/ordens/nova" search={{}}><Plus /> Nova OS</Link></Button>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {(isAdmin || isSecretary) ? <Outlet /> : (
          <div className="mx-auto max-w-md rounded-md border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto size-10 text-warning" />
            <h1 className="mt-4 text-xl">Acesso aguardando liberação</h1>
            <p className="mt-2 text-sm text-muted-foreground">A conta <strong className="text-foreground">{user.email}</strong> não tem permissão para acessar o painel. Somente a conta administradora da oficina pode entrar.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function PanelLink({ to, icon, label, exact }: {
  to: "/painel" | "/painel/agendamentos" | "/painel/orcamentos" | "/painel/clientes" | "/painel/veiculos" | "/painel/garantias" | "/painel/financeiro" | "/painel/relatorios" | "/painel/cobrancas";
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  return <Link to={to} activeOptions={{ exact: !!exact }}
    className="flex shrink-0 items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4"
    activeProps={{ className: "bg-secondary text-foreground" }}>{icon}{label}</Link>;
}
