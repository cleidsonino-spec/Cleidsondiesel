import { useCallback, useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchMaterialLists, finalizeMaterialList, saveMaterialList, type MaterialList } from "@/lib/material-lists";

export const Route = createFileRoute("/_authenticated/painel/materiais")({
  head: () => ({ meta: [{ title: "Lista de materiais — Cleidson Diesel" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => {
    if (!context.isAdmin && !context.isSecretary) throw redirect({ to: "/painel" });
  },
  component: MaterialListsPage,
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function MaterialListsPage() {
  const [lists, setLists] = useState<MaterialList[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLists(await fetchMaterialLists());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as listas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function save(listId: string) {
    setBusyId(listId);
    try {
      await saveMaterialList(listId);
      await refresh();
      toast.success("Lista salva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a lista.");
    } finally {
      setBusyId(null);
    }
  }

  async function finalize(listId: string) {
    if (!window.confirm("Finalizar esta lista? Depois disso, os itens não poderão ser alterados.")) return;
    setBusyId(listId);
    try {
      await finalizeMaterialList(listId);
      await refresh();
      toast.success("Lista finalizada. O material necessário está pronto para impressão.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a lista.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <ClipboardList className="size-7" />
          <div><h1 className="text-2xl font-semibold">Lista de materiais</h1><p className="text-sm text-muted-foreground">Peças separadas na Central Técnica para compra.</p></div>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer /> Imprimir material necessário</Button>
      </header>

      {loading ? <p className="text-sm text-muted-foreground">Carregando listas...</p> : lists.length === 0 ? (
        <section className="rounded-lg border p-6 text-center">
          <p className="font-medium">Nenhuma lista de materiais salva.</p>
          <p className="mt-1 text-sm text-muted-foreground">Na Central Técnica, selecione uma peça e use “Adicionar à lista de materiais”.</p>
        </section>
      ) : lists.map((list) => (
        <section key={list.id} className="space-y-4 rounded-lg border bg-card p-4 print:break-inside-avoid">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{list.title}</h2>
              <p className="text-xs text-muted-foreground">Criada em {formatDate(list.created_at)} · {list.material_list_items.length} peça(s)</p>
              <p className="mt-1 text-sm font-medium">{list.status === "draft" ? "Em andamento" : `Finalizada em ${formatDate(list.finalized_at ?? list.updated_at)}`}</p>
            </div>
            <div className="flex gap-2 print:hidden">
              {list.status === "draft" ? <>
                <Button variant="outline" size="sm" disabled={busyId === list.id} onClick={() => void save(list.id)}><Save /> Salvar</Button>
                <Button size="sm" disabled={busyId === list.id || list.material_list_items.length === 0} onClick={() => void finalize(list.id)}><CheckCircle2 /> Finalizar</Button>
              </> : <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Imprimir lista</Button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse text-sm">
              <thead><tr className="border-b text-left"><th className="p-2">Código</th><th className="p-2">Peça</th><th className="p-2">Bomba / aplicação</th><th className="p-2 text-right">Qtd.</th></tr></thead>
              <tbody>
                {list.material_list_items.map((item) => <tr key={item.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{item.reference_code}</td>
                  <td className="p-2">{item.description}{item.manufacturer ? <span className="block text-xs text-muted-foreground">{item.manufacturer}</span> : null}{item.catalog_position ? <span className="block text-xs text-muted-foreground">Pos. {item.catalog_position}</span> : null}</td>
                  <td className="p-2">{item.pump_code || "—"}</td>
                  <td className="p-2 text-right tabular-nums">{item.quantity_needed}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-muted-foreground print:hidden">As listas finalizadas ficam guardadas para consulta. Esta função não cria ordem de serviço nem orçamento.</p>
    </main>
  );
}
