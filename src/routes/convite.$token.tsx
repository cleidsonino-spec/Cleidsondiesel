import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
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
  const [email, setEmail] = useState("");
  const [resolvingInvite, setResolvingInvite] = useState(true);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailConfirmation, setEmailConfirmation] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);

  useEffect(() => {
    let active = true;
    (supabase as any).rpc("get_staff_invitation_email", { p_token: token }).then(({ data, error }: { data: string | null; error: { message: string } | null }) => {
      if (!active) return;
      setResolvingInvite(false);
      if (error || !data) {
        setInviteInvalid(true);
        return;
      }
      setEmail(data.toLowerCase());
    });
    return () => { active = false; };
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email) { toast.error("Não foi possível identificar o convite. Peça um novo link."); return; }
    if (password.length < 8) { toast.error(existingAccount ? "Informe sua senha atual (mínimo de 8 caracteres)." : "A senha deve ter pelo menos 8 caracteres."); return; }
    if (!existingAccount && password !== confirm) { toast.error("As senhas não conferem."); return; }
    setLoading(true);
    if (existingAccount) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (loginError) { setLoading(false); toast.error("Não foi possível entrar. Confira o e-mail e a senha atual da conta."); return; }
      const { error: acceptError } = await supabase.rpc("accept_staff_invitation_for_existing_user", { p_token: token });
      setLoading(false);
      if (acceptError) { toast.error(acceptError.message.includes("STAFF_INVITATION_INVALID_OR_EXPIRED") ? "Convite inválido, expirado ou já utilizado. Peça um novo convite." : "Login realizado, mas não foi possível concluir o convite. Tente novamente ou peça um novo convite."); return; }
      toast.success("Convite aceito! Seu acesso à equipe foi liberado.");
      navigate({ to: "/equipe" });
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { staff_invitation_token: token },
        emailRedirectTo: new URL("/auth", window.location.origin).toString(),
      },
    });
    setLoading(false);
    if (error) {
      const invalid = /STAFF_INVITATION_INVALID_OR_EXPIRED/i.test(error.message);
      toast.error(invalid ? "Convite inválido, expirado ou já utilizado. Peça um novo convite." : "Não foi possível ativar a conta. Verifique o e-mail ou peça um novo convite.");
      return;
    }
    if (data.session) {
      toast.success("Acesso ativado com sucesso!");
      navigate({ to: "/equipe" });
      return;
    }
    setEmailConfirmation(true);
    toast.success("Conta criada. Confirme o e-mail enviado para concluir o acesso.");
  }

  return <main className="flex min-h-screen items-center justify-center px-4 py-10">
    <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6">
      <div className="flex justify-center"><Logo/></div>
      <div className="text-center"><KeyRound className="mx-auto size-8 text-primary"/><h1 className="mt-3 text-2xl font-semibold">{emailConfirmation ? "Confirme seu e-mail" : "Ativar acesso da equipe"}</h1><p className="mt-2 text-sm text-muted-foreground">{emailConfirmation ? "Enviamos uma mensagem para o endereço cadastrado no convite. Confirme-o para concluir o acesso." : existingAccount ? "Informe sua senha atual para entrar e aceitar o convite." : "Crie sua senha para ativar o acesso. O link vence em 7 dias e só pode ser usado uma vez."}</p></div>
      {resolvingInvite && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>Validando convite…</div>}
      {inviteInvalid && <p className="text-center text-sm text-destructive">Este link é inválido, expirou ou já foi utilizado. Peça um novo convite ao administrador.</p>}
      {!emailConfirmation && !resolvingInvite && !inviteInvalid && <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm"><span>{existingAccount ? "Senha atual" : "Nova senha"}</span><Input type="password" autoComplete={existingAccount ? "current-password" : "new-password"} minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>
        {!existingAccount && <label className="block space-y-1 text-sm"><span>Confirmar senha</span><Input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>}
        <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 size-4 animate-spin"/>}{existingAccount ? "Entrar e aceitar convite" : "Ativar minha conta"}</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => { setExistingAccount(v => !v); setPassword(""); setConfirm(""); }}>{existingAccount ? "Ainda não tenho uma conta" : "Já tenho uma conta — entrar para aceitar convite"}</Button>
      </form>}
      {emailConfirmation && <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>Ir para o login</Button>}
    </div>
  </main>;
}
