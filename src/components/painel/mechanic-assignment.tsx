import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRoundCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Mechanic = { accepted_user_id: string; full_name: string; email: string };
type Assignment = { id: string; mechanic_user_id: string };

export function MechanicAssignment({ serviceOrderId }: { serviceOrderId: string }) {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: staff, error: staffError }, { data: current, error: assignmentError }] = await Promise.all([
      (supabase as any).from("staff_invitations")
        .select("accepted_user_id, full_name, email")
        .eq("role", "mecanico").not("accepted_user_id", "is", null)
        .not("used_at", "is", null).is("revoked_at", null)
        .order("full_name", { ascending: true }),
      (supabase as any).from("service_order_assignments")
        .select("id, mechanic_user_id").eq("service_order_id", serviceOrderId)
        .eq("active", true).maybeSingle(),
    ]);
    setLoading(false);
    if (staffError || assignmentError) {
      toast.error("Não foi possível carregar a equipe atribuível.");
      return;
    }
    setMechanics((staff ?? []) as Mechanic[]);
    setAssignment(current as Assignment | null);
    setSelected(current?.mechanic_user_id ?? "");
  }

  useEffect(() => { void load(); }, [serviceOrderId]);

  async function save() {
    if (!selected) { toast.error("Selecione um mecânico."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Sua sessão expirou. Entre novamente."); return; }
    setSaving(true);
    const payload = {
      mechanic_user_id: selected,
      assigned_by: auth.user.id,
      assigned_at: new Date().toISOString(),
      active: true,
    };
    const result = assignment
      ? await (supabase as any).from("service_order_assignments").update(payload).eq("id", assignment.id)
      : await (supabase as any).from("service_order_assignments").insert({ ...payload, service_order_id: serviceOrderId });
    setSaving(false);
    if (result.error) {
      toast.error("Não foi possível atribuir esta ordem. Verifique as permissões.");
      return;
    }
    toast.success("Mecânico atribuído à ordem de serviço.");
    await load();
  }

  return <section className="space-y-3 rounded-md border border-border bg-card p-4 print:hidden">
    <div className="flex items-center gap-2"><UserRoundCheck className="size-5 text-primary"/><div><h2 className="font-semibold">Responsável pelo serviço</h2><p className="text-sm text-muted-foreground">Atribua esta OS a um mecânico da equipe.</p></div></div>
    {loading ? <p className="text-sm text-muted-foreground">Carregando equipe…</p> : mechanics.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum mecânico ativou o convite ainda. Envie um convite pelo painel e aguarde a ativação.</p> : <div className="flex flex-col gap-2 sm:flex-row">
      <select aria-label="Selecionar mecânico" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">Selecione um mecânico</option>
        {mechanics.map(person => <option key={person.accepted_user_id} value={person.accepted_user_id}>{person.full_name} · {person.email}</option>)}
      </select>
      <Button type="button" onClick={() => void save()} disabled={saving || !selected}>{saving ? "Salvando…" : assignment ? "Atualizar responsável" : "Atribuir mecânico"}</Button>
    </div>}
  </section>;
}
