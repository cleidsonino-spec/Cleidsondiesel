import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type StaffAccount = {
  user_id: string;
  full_name: string;
  email: string;
  role: "mecanico" | "secretaria";
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
};

export function StaffManagement() {
  const [items, setItems] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_list_staff_accounts");
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar os funcionários.");
      return;
    }
    setItems((data ?? []) as StaffAccount[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(staff: StaffAccount) {
    const nextActive = !staff.is_active;
    const action = nextActive ? "reativar" : "desativar";
    const message = nextActive
      ? `Deseja reativar o acesso de ${staff.full_name}?`
      : `Deseja desativar ${staff.full_name}? O acesso às áreas protegidas será bloqueado. O histórico e as ordens de serviço serão preservados.`;
    if (!window.confirm(message)) return;

    setChangingId(staff.user_id);
    const { error } = await (supabase as any).rpc("admin_set_staff_active", {
      _staff_user_id: staff.user_id,
      _active: nextActive,
    });
    setChangingId(null);
    if (error) {
      toast.error(error.message || `Não foi possível ${action} o funcionário.`);
      return;
    }
    toast.success(nextActive ? "Funcionário reativado." : "Funcionário desativado.");
    await load();
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Funcionários cadastrados</h2>
          <p className="text-sm text-muted-foreground">Desative ou reative o acesso sem excluir a conta nem o histórico de serviços.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 size-4" /> Atualizar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando funcionários…</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum funcionário com conta ativa ou histórico de convite foi encontrado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((staff) => (
            <div key={staff.user_id + staff.role} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="font-medium">{staff.full_name || staff.email}</p>
                <p className="break-all text-xs text-muted-foreground">{staff.email} · {staff.role === "mecanico" ? "Mecânico" : "Secretária"}</p>
                <p className="text-xs text-muted-foreground">
                  {staff.is_active ? "Acesso ativo" : "Acesso desativado"}
                  {staff.deactivated_at ? ` · desativado em ${new Date(staff.deactivated_at).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={staff.is_active ? "destructive" : "outline"}
                onClick={() => void changeStatus(staff)}
                disabled={changingId !== null}
              >
                {staff.is_active ? <><ShieldOff className="mr-2 size-4" /> Desativar</> : <><ShieldCheck className="mr-2 size-4" /> Reativar</>}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
