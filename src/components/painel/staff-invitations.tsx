import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, MessageCircle, RefreshCw, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Invitation = {
  id: string; full_name: string; email: string; phone: string; role: "mecanico" | "secretaria";
  created_at: string; expires_at: string; used_at: string | null; revoked_at: string | null;
};

function statusOf(invite: Invitation) {
  if (invite.used_at) return "Aceito";
  if (invite.revoked_at) return "Revogado";
  if (new Date(invite.expires_at).getTime() <= Date.now()) return "Expirado";
  return "Pendente";
}

export function StaffInvitations() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [lastLink, setLastLink] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "mecanico" as "mecanico" | "secretaria" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("staff-invitations", { body: { action: "list" } });
    setLoading(false);
    if (error || data?.error) { toast.error("Não foi possível carregar os convites."); return; }
    setItems(data.invitations ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("staff-invitations", {
      body: { action: "create", ...form },
    });
    setCreating(false);
    if (error || data?.error) { toast.error("Não foi possível criar o convite. Confira os dados."); return; }
    const link = new URL("/convite/" + data.token, window.location.origin).toString();
    setLastLink(link);
    const digits = form.phone.replace(/\D/g, "");
    const phone = digits.startsWith("55") ? digits : "55" + digits;
    const message = `Olá, ${form.full_name}! Você foi convidado(a) para acessar o painel da Cleidson Diesel como ${form.role === "mecanico" ? "mecânico" : "secretaria"}. Acesse o link para criar sua senha (válido por 7 dias): ${link}`;
    const whatsapp = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
    window.open(whatsapp, "_blank", "noopener,noreferrer");
    toast.success("Convite criado. Finalize o envio no WhatsApp.");
    setForm({ full_name: "", email: "", phone: "", role: "mecanico" });
    await load();
  }

  async function copyLink() {
    if (!lastLink) return;
    try { await navigator.clipboard.writeText(lastLink); toast.success("Link copiado."); }
    catch { toast.error("Não foi possível copiar o link neste navegador."); }
  }

  async function revoke(id: string) {
    const { data, error } = await supabase.functions.invoke("staff-invitations", { body: { action: "revoke", id } });
    if (error || data?.error) { toast.error("Não foi possível cancelar o convite."); return; }
    toast.success("Convite cancelado.");
    await load();
  }

  return <section className="space-y-5 rounded-lg border bg-card p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-xl font-semibold">Convites da equipe</h2><p className="text-sm text-muted-foreground">Crie o acesso e compartilhe o link pelo WhatsApp. O link vence em 7 dias e só pode ser usado uma vez.</p></div>
      <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 size-4"/>Atualizar</Button>
    </div>

    <form onSubmit={createInvite} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm"><span>Nome completo</span><Input required minLength={2} maxLength={100} value={form.full_name} onChange={e => setForm(v => ({...v, full_name:e.target.value}))} placeholder="Nome do funcionário"/></label>
      <label className="space-y-1 text-sm"><span>E-mail de acesso</span><Input required type="email" value={form.email} onChange={e => setForm(v => ({...v, email:e.target.value}))} placeholder="funcionario@email.com"/></label>
      <label className="space-y-1 text-sm"><span>WhatsApp com DDD</span><Input required type="tel" value={form.phone} onChange={e => setForm(v => ({...v, phone:e.target.value}))} placeholder="(71) 99999-9999"/></label>
      <label className="space-y-1 text-sm"><span>Função</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role} onChange={e => setForm(v => ({...v, role:e.target.value as "mecanico" | "secretaria"}))}><option value="mecanico">Mecânico</option><option value="secretaria">Secretaria</option></select></label>
      <div className="sm:col-span-2"><Button type="submit" disabled={creating}><UserPlus className="mr-2 size-4"/>{creating ? "Criando convite…" : "Criar e enviar pelo WhatsApp"}</Button></div>
    </form>

    {lastLink && <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3"><p className="min-w-0 flex-1 break-all text-xs">{lastLink}</p><Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}><Copy className="mr-1 size-4"/>Copiar</Button></div>}

    <div className="space-y-2">
      <h3 className="font-medium">Histórico de convites</h3>
      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum convite criado.</p> : items.map(invite => {
        const status = statusOf(invite);
        return <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div className="min-w-0"><p className="font-medium">{invite.full_name} · {invite.role === "mecanico" ? "Mecânico" : "Secretaria"}</p><p className="break-all text-xs text-muted-foreground">{invite.email} · {invite.phone}</p><p className="text-xs text-muted-foreground">{status} · vence {new Date(invite.expires_at).toLocaleDateString("pt-BR")}</p></div>
          {!invite.used_at && !invite.revoked_at && status === "Pendente" && <Button type="button" variant="ghost" size="sm" onClick={() => void revoke(invite.id)}><XCircle className="mr-1 size-4"/>Cancelar</Button>}
        </div>;
      })}
    </div>
  </section>;
}
