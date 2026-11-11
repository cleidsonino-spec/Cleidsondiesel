import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Users, Wrench } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type MechanicProductionRow = {
  mechanic_user_id: string;
  mechanic_name: string;
  assigned_orders: number;
  active_orders: number;
  completed_orders: number;
  technical_entries: number;
  verified_procedures: number;
};

const countsKey = ["mechanic-service-counts"];

export function MechanicProduction({ canReset = false }: { canReset?: boolean }) {
  const queryClient = useQueryClient();

  const productionQuery = useQuery({
    queryKey: countsKey,
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client.rpc("staff_mechanic_service_counts");
      if (error) throw error;
      return (data ?? []) as MechanicProductionRow[];
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const client = supabase as any;
      const { data, error } = await client.rpc("staff_reset_mechanic_service_counts");
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: countsKey });
      toast.success("Contagem de produção reiniciada.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível zerar a contagem.");
    },
  });

  const rows = productionQuery.data ?? [];

  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-4" aria-label="Produção por mecânico">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Produção por Mecânico</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe os serviços atribuídos e os procedimentos registrados por cada mecânico.
          </p>
        </div>
        {canReset && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={resetMutation.isPending}>
                <RotateCcw className="size-4" /> Zerar contagem
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Zerar a produção de todos os mecânicos?</AlertDialogTitle>
                <AlertDialogDescription>
                  Os números exibidos começarão do zero a partir de agora. As ordens de serviço e todos os registros técnicos antigos serão preservados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={resetMutation.isPending}
                  onClick={() => resetMutation.mutate()}
                >
                  {resetMutation.isPending ? "Reiniciando..." : "Sim, zerar contagem"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {productionQuery.isPending ? (
        <p className="py-5 text-sm text-muted-foreground">Carregando produção...</p>
      ) : productionQuery.isError ? (
        <p className="py-5 text-sm text-destructive">
          Não foi possível carregar a produção. {(productionQuery.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-5 text-sm text-muted-foreground">Nenhum mecânico cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-3 font-medium">Mecânico</th>
                <th className="px-3 py-3 text-right font-medium">OS atribuídas</th>
                <th className="px-3 py-3 text-right font-medium">Em andamento</th>
                <th className="px-3 py-3 text-right font-medium">Concluídas</th>
                <th className="px-3 py-3 text-right font-medium">Registros técnicos</th>
                <th className="px-3 py-3 text-right font-medium">Conferidos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.mechanic_user_id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3 font-medium">
                    <span className="flex items-center gap-2"><Wrench className="size-4 text-muted-foreground" />{row.mechanic_name}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{Number(row.assigned_orders ?? 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{Number(row.active_orders ?? 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{Number(row.completed_orders ?? 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{Number(row.technical_entries ?? 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{Number(row.verified_procedures ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
