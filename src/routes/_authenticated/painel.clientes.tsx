import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Customer = {
  id: string; name: string; document: string | null; phone: string | null;
  email: string | null; address: string | null; notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/painel/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Cleidson Diesel" }] }),
  component: ClientesPage,
});

const empty = { name: "", document: "", phone: "", email: "", address: "", notes: "" };

function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("customers").select("*").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const filtered = data.filter((c) =>
    [c.name, c.document, c.phone, c.email].some((v) => v?.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Informe o nome do cliente."); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("customers").insert({
        name: form.name.trim(), document: form.document.trim() || null,
        phone: form.phone.trim() || null, email: form.email.trim() || null,
        address: form.address.trim() || null, notes: form.notes.trim() || null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["customers"] });
      setForm(empty); setShowForm(false);
      toast.success("Cliente cadastrado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cadastrar o cliente.");
    } finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm uppercase tracking-wider text-primary">Área administrativa</p><h1 className="text-3xl">Clientes</h1><p className="text-sm text-muted-foreground">Cadastro e consulta dos clientes da oficina.</p></div>
      <Button onClick={() => setShowForm((v) => !v)}><UserPlus /> {showForm ? "Fechar cadastro" : "Novo cliente"}</Button>
    </div>
    {showForm && <form onSubmit={save} className="grid gap-4 rounded-md border border-border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label>Nome completo *</Label><Input required value={form.name} onChange={e => setForm({...form,name:e.target.value})} /></div>
      <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.document} onChange={e => setForm({...form,document:e.target.value})} /></div>
      <div className="space-y-2"><Label>Telefone / WhatsApp</Label><Input type="tel" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} /></div>
      <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} /></div>
      <div className="space-y-2"><Label>Endereço</Label><Input value={form.address} onChange={e => setForm({...form,address:e.target.value})} /></div>
      <div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} /></div>
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar cliente"}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button></div>
    </form>}
    <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail" value={search} onChange={e => setSearch(e.target.value)} /></div>
    {isLoading ? <p className="text-sm text-muted-foreground">Carregando clientes...</p> : error ? <p className="text-sm text-destructive">Não foi possível carregar os clientes. Verifique se a atualização do banco foi aplicada.</p> : filtered.length === 0 ? <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 size-8" />Nenhum cliente cadastrado.</div> :
      <div className="divide-y rounded-md border bg-card">{filtered.map(c => <div key={c.id} className="p-4"><p className="font-semibold">{c.name}</p><p className="text-sm text-muted-foreground">{[c.document,c.phone,c.email].filter(Boolean).join(" · ") || "Sem contato informado"}</p>{c.address && <p className="text-sm text-muted-foreground">{c.address}</p>}</div>)}</div>}
    <p className="text-xs text-muted-foreground">{data.length} cliente(s) cadastrado(s).</p>
  </div>;
}
