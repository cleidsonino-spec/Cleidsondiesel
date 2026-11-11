import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRoundCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Mechanic = { accepted_user_id: string; full_name: string; email: string };

export function MechanicAssignment({ serviceOrderId, stage }: { serviceOrderId: string; stage: "diagnostico" | "servico" }) {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [selected, setSelected] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: staff, error: staffError }, { data: current, error: assignmentError }] = await Promise.all([
      (supabase as any).from("staff_invitations").select("accepted_user_id, full_name, email")
        .eq("role", "mecanico").not("accepted_user_id", "is", null)
        .not("used_at", "is", null).is("revoked_at", null).order("full_name", { ascending: true }),
      (supabase as any).from("service_order_assignments").select("mechanic_user_id")
        .eq("service_order_id", serviceOrderId).eq("active", true).maybeSingle(),
    ]);
    if (staffError || assignmentError) toast.error("Não foi possível carregar a equipe atribuível.");
    const people = (staff ?? []) as Mechanic[];
    setMechanics(people);
    const activeId = current?.mechanic_user_id ?? "";
    setSelected(activeId);
    setCurrentName(people.find(person => person.accepted_user_id === activeId)?.full_name ?? "");
    setLoading(false);
  }

  useEffect(() => { void load(); }, [serviceOrderId, stage]);

  async function save() {
    if (!selected) { toast.error("Selecione um mecânico."); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("assign_order_to_mechanic", {
      _order_id: serviceOrderId, _mechanic_user_id: selected, _stage: stage,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Não foi possível encaminhar a ordem."); return; }
    toast.success(stage === "diagnostico" ? "Diagnóstico encaminhado ao mecânico." : "Serviço encaminhado ao mecânico.");
    await load();
  }

  const diagnosis = stage === "diagnostico";
  return <section className="space-y-3 rounded-md border border-border bg-card p-4 print:hidden">
    <div className="flex items-center gap-2"><UserRoundCheck className="size-5 text-primary"/><div>
      <h2 className="font-semibold">{diagnosis ? "Encaminhar para diagnóstico" : "Encaminhar serviço autorizado"}</h2>
      <p className="text-sm text-muted-foreground">{diagnosis ? "Escolha quem fará os testes e registrará o diagnóstico." : "O orçamento já foi aprovado. Escolha quem executará o reparo."}</p>
    </div></div>
    {currentName && <p className="text-sm">Responsável atual: <strong>{currentName}</strong></p>}
    {loading ? <p className="text-sm text-muted-foreground">Carregando equipe…</p> : mechanics.length === 0
      ? <p className="text-sm text-muted-foreground">Nenhum mecânico ativou o convite ainda.</p>
      : <div className="flex flex-col gap-2 sm:flex-row">
        <select aria-label="Selecionar mecânico" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Selecione um mecânico</option>
          {mechanics.map(person => <option key={person.accepted_user_id} value={person.accepted_user_id}>{person.full_name} · {person.email}</option>)}
        </select>
        <Button type="button" onClick={() => void save()} disabled={saving || !selected}>{saving ? "Encaminhando…" : currentName ? "Alterar responsável" : "Encaminhar OS"}</Button>
      </div>}
  </section>;
}
