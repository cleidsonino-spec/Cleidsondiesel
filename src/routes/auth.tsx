import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";

import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no painel — Cleidson Diesel" },
      { name: "description", content: "Acesso restrito à equipe da oficina Cleidson Diesel." },
      { property: "og:title", content: "Entrar no painel — Cleidson Diesel" },
      { property: "og:description", content: "Área restrita da oficina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel" });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/painel" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    setLoading(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) toast.error("E-mail ou senha incorretos.");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/painel" },
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else setSent(true);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    const redirectUri = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
      ? "br.com.cleidsondiesel.painel://auth/callback"
      : window.location.origin + "/auth";
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: redirectUri });
    if (result.error) toast.error("Não foi possível entrar. Tente novamente.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center steel-grid px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-md border border-border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <h1 className="text-xl">Painel da oficina</h1>
          </div>

          {sent ? (
            <p className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para seu e-mail. Clique nele para ativar o acesso.
            </p>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-sm bg-muted p-1" role="tablist">
                {(
                  [
                    ["signin", "Entrar"],
                    ["signup", "Criar conta"],
                  ] as const
                ).map(([m, l]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={
                      mode === m
                        ? "rounded-sm bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow"
                        : "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground"
                    }
                  >
                    {l}
                  </button>
                ))}
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {mode === "signin" ? "Entrar" : "Criar conta"}
                </Button>
              </form>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                <button type="button" onClick={() => oauth("google")} className="google-btn">
                  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
                  Continuar com o Google
                </button>
                <button type="button" onClick={() => oauth("lovable")} className="lovable-auth-button w-full">
                  Continuar com Lovable
                </button>
              </div>
            </>
          )}
          <p className="mt-5 text-xs text-muted-foreground">
            A primeira conta criada vira a administradora da oficina.
          </p>
        </div>
      </div>
    </div>
  );
}
