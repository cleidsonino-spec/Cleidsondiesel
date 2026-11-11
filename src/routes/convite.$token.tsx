import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({ meta: [
    { title: "Ativar acesso da equipe — Cleidson Diesel" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AcceptInvitation,
});

function AcceptInvitation() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { toast.error("As senhas não conferem."); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("staff-invitations", {
      body: { action: "accept", token, password },
    });
    if (error || data?.error) {
      setLoading(false);
      const messages: Record<string, string> = {
        INVITATION_INVALID_OR_EXPIRED: "Este convite é inválido, expirou ou já foi utilizado.",
        EMAIL_ALREADY_REGISTERED: "Este e-mail já possui uma conta. Solicite um novo convite com outro e-mail.",
      };
      toast.error(messages[data?.error] ?? "Não foi possível ativar o acesso.");
      return;
    }
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: data.email, password });
    setLoading(false);
    if (loginError) { toast.success("Acesso criado. Entre com seu e-mail e senha."); navigate({ to: "/auth" }); return; }
    toast.success("Acesso ativado com sucesso!");
    navigate({ to: "/equipe" });
  }

  return <main className="flex min-h-screen items-center justify-center px-4 py-10">
    <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6">
      <div className="flex justify-center"><Logo/></div>
      <div className="text-center"><KeyRound className="mx-auto size-8 text-primary"/><h1 className="mt-3 text-2xl font-semibold">Ativar acesso da equipe</h1><p className="mt-2 text-sm text-muted-foreground">Crie uma senha para acessar o painel da Cleidson Diesel. Este convite é válido por 7 dias e só pode ser usado uma vez.</p></div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm"><span>Nova senha</span><Input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="block space-y-1 text-sm"><span>Confirmar senha</span><Input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 size-4 animate-spin"/>}Ativar minha conta</Button>
      </form>
    </div>
  </main>;
}
