import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Package, Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/painel/estoque")({
  head: () => ({ meta: [
    { title: "Estoque e fornecedores — Cleidson Diesel" },
    { name: "description", content: "Controle de peças, movimentações e fornecedores da oficina." },
    { name: "robots", content: "noindex" },
  ] }),
  component: InventoryPage,
});

type Supplier = { id: string; name: string; phone: string | null; email: string | null };
type Item = {
  id: string; code: string | null; name: string; brand: string | null; category: string | null;
  unit: string; cost_price: number; sale_price: number; stock_quantity: number;
  minimum_stock: number; location: string | null; supplier_id: string | null;
};
type Order = { id: string; number: number; customer_name: string; plate: string };
type Movement = {
  id: string; item_id: string; movement_type: "entrada" | "saida"; quantity: number;
  unit_cost: number | null; notes: string | null; created_at: string;
};

function InventoryPage() {
  const { isAdmin } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemBrand, setItemBrand] = useState("");
  const [itemCategory, setItemCategory] = useState("Peças");
  const [itemUnit, setItemUnit] = useState("un");
  const [itemCost, setItemCost] = useState("0");
  const [itemPrice, setItemPrice] = useState("0");
  const [itemMinimum, setItemMinimum] = useState("0");
  const [itemLocation, setItemLocation] = useState("");
  const [itemSupplier, setItemSupplier] = useState("");
  const [movementItem, setMovementItem] = useState("");
  const [movementType, setMovementType] = useState<"entrada" | "saida">("entrada");
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [movementCost, setMovementCost] = useState("");
  const [movementSupplier, setMovementSupplier] = useState("");
  const [movementOrder, setMovementOrder] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const inventory = useQuery({
    queryKey: ["inventory-management"],
    enabled: isAdmin,
    queryFn: async () => {
      const [items, suppliers, movements, orders] = await Promise.all([
        (supabase as any).from("inventory_items").select("*").order("name"),
        (supabase as any).from("suppliers").select("id,name,phone,email").order("name"),
        (supabase as any).from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("service_orders").select("id,number,customer_name,plate").order("number", { ascending: false }).limit(300),
      ]);
      for (const result of [items, suppliers, movements, orders]) if (result.error) throw result.error;
      return {
        items: (items.data ?? []) as Item[],
        suppliers: (suppliers.data ?? []) as Supplier[],
        movements: (movements.data ?? []) as Movement[],
        orders: (orders.data ?? []) as Order[],
      };
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["inventory-management"] });
  }
  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supplierName.trim().length < 2) return;
    setSaving(true);
    const { error } = await (supabase as any).from("suppliers").insert({
      name: supplierName.trim(), phone: supplierPhone.trim() || null, email: supplierEmail.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fornecedor cadastrado.");
    setSupplierName(""); setSupplierPhone(""); setSupplierEmail("");
    await refresh();
  }
  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cost = Number(itemCost.replace(",", "."));
    const price = Number(itemPrice.replace(",", "."));
    const minimum = Number(itemMinimum.replace(",", "."));
    if (itemName.trim().length < 2 || ![cost, price, minimum].every((v) => Number.isFinite(v) && v >= 0)) {
      toast.error("Confira o nome e os valores do produto."); return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("inventory_items").insert({
      name: itemName.trim(), code: itemCode.trim() || null, brand: itemBrand.trim() || null,
      category: itemCategory.trim() || null, unit: itemUnit.trim() || "un",
      cost_price: cost, sale_price: price, minimum_stock: minimum,
      location: itemLocation.trim() || null, supplier_id: itemSupplier || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Produto cadastrado no estoque.");
    setItemName(""); setItemCode(""); setItemBrand(""); setItemCost("0"); setItemPrice("0");
    setItemMinimum("0"); setItemLocation(""); setItemSupplier("");
    await refresh();
  }
  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(movementQuantity.replace(",", "."));
    const cost = movementCost.trim() ? Number(movementCost.replace(",", ".")) : null;
    if (!movementItem || !Number.isFinite(quantity) || quantity <= 0 || (cost !== null && (!Number.isFinite(cost) || cost < 0))) {
      toast.error("Informe o produto e uma quantidade válida."); return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("inventory_movements").insert({
      item_id: movementItem, movement_type: movementType, quantity,
      unit_cost: cost, supplier_id: movementSupplier || null,
      service_order_id: movementType === "saida" ? movementOrder || null : null,
      notes: movementNotes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(movementType === "entrada" ? "Entrada registrada e estoque atualizado." : "Saída registrada e estoque atualizado.");
    setMovementQuantity("1"); setMovementCost(""); setMovementNotes("");
    await refresh();
  }

  if (!isAdmin) return <section className="rounded-md border p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted-foreground">Somente o administrador pode gerenciar estoque e fornecedores.</p></section>;

  const data = inventory.data;
  const lowStock = (data?.items ?? []).filter((item) => Number(item.stock_quantity) <= Number(item.minimum_stock));
  const selectedItem = data?.items.find((item) => item.id === movementItem);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Gestão da oficina</p>
        <h1 className="text-3xl">Estoque e fornecedores</h1>
        <p className="text-sm text-muted-foreground">Cadastre peças, acompanhe quantidades e registre cada entrada e saída. Nenhuma peça é baixada automaticamente pela OS.</p>
      </header>
      {inventory.isLoading ? <p className="rounded-md border p-6 text-sm text-muted-foreground">Carregando estoque…</p> : inventory.isError ? (
        <div className="rounded-md border border-destructive/40 p-5"><h2 className="font-semibold">Não foi possível carregar o estoque</h2><p className="mt-1 text-sm text-muted-foreground">{inventory.error instanceof Error ? inventory.error.message : "Verifique se a migração do estoque foi aplicada."}</p></div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric icon={<Boxes />} label="Produtos cadastrados" value={String(data?.items.length ?? 0)} />
            <Metric icon={<AlertTriangle />} label="Abaixo do mínimo" value={String(lowStock.length)} />
            <Metric icon={<Truck />} label="Fornecedores" value={String(data?.suppliers.length ?? 0)} />
          </section>
          {lowStock.length > 0 && <section className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4"><h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Atenção: estoque no mínimo ou abaixo</h2><p className="mt-1 text-sm text-muted-foreground">{lowStock.map((item) => item.name).join(" · ")}</p></section>}
          <section className="grid gap-5 xl:grid-cols-2">
            <form onSubmit={saveItem} className="space-y-3 rounded-md border bg-card p-4">
              <div><h2 className="flex items-center gap-2 font-semibold"><Package /> Cadastrar peça / produto</h2><p className="text-xs text-muted-foreground">O saldo inicial começa em zero. Registre a entrada para formar o estoque.</p></div>
              <label className="grid gap-1 text-sm"><span>Nome</span><input required minLength={2} maxLength={180} value={itemName} onChange={(e) => setItemName(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Código / referência"><input value={itemCode} onChange={(e) => setItemCode(e.target.value)} className={inputClass} /></Field>
                <Field label="Marca"><input value={itemBrand} onChange={(e) => setItemBrand(e.target.value)} className={inputClass} /></Field>
                <Field label="Categoria"><input value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={inputClass} /></Field>
                <Field label="Unidade"><select value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} className={inputClass}><option value="un">Unidade</option><option value="kit">Kit</option><option value="jogo">Jogo</option><option value="litro">Litro</option><option value="metro">Metro</option></select></Field>
                <Field label="Custo unitário (R$)"><input type="number" min="0" step="0.01" value={itemCost} onChange={(e) => setItemCost(e.target.value)} className={inputClass} /></Field>
                <Field label="Preço de venda (R$)"><input type="number" min="0" step="0.01" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className={inputClass} /></Field>
                <Field label="Estoque mínimo"><input type="number" min="0" step="0.001" value={itemMinimum} onChange={(e) => setItemMinimum(e.target.value)} className={inputClass} /></Field>
                <Field label="Localização"><input value={itemLocation} onChange={(e) => setItemLocation(e.target.value)} className={inputClass} placeholder="Ex.: Prateleira A2" /></Field>
              </div>
              <Field label="Fornecedor padrão"><select value={itemSupplier} onChange={(e) => setItemSupplier(e.target.value)} className={inputClass}><option value="">Sem fornecedor</option>{(data?.suppliers ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
              <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Cadastrar produto"}</Button>
            </form>

            <div className="space-y-5">
              <form onSubmit={saveSupplier} className="space-y-3 rounded-md border bg-card p-4">
                <div><h2 className="flex items-center gap-2 font-semibold"><Truck /> Cadastrar fornecedor</h2><p className="text-xs text-muted-foreground">Guarde os contatos para compras e reposição.</p></div>
                <Field label="Nome / empresa"><input required minLength={2} maxLength={160} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} /></Field>
                <div className="grid gap-3 sm:grid-cols-2"><Field label="Telefone"><input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} className={inputClass} /></Field><Field label="E-mail"><input type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} className={inputClass} /></Field></div>
                <Button type="submit" variant="outline" disabled={saving}>{saving ? "Salvando…" : "Cadastrar fornecedor"}</Button>
              </form>

              <form onSubmit={saveMovement} className="space-y-3 rounded-md border bg-card p-4">
                <div><h2 className="font-semibold">Registrar movimentação</h2><p className="text-xs text-muted-foreground">Saídas são bloqueadas quando não há saldo suficiente.</p></div>
                <Field label="Produto"><select required value={movementItem} onChange={(e) => setMovementItem(e.target.value)} className={inputClass}><option value="">Selecione</option>{(data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · saldo {item.stock_quantity} {item.unit}</option>)}</select></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tipo"><select value={movementType} onChange={(e) => setMovementType(e.target.value as "entrada" | "saida")} className={inputClass}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></Field>
                  <Field label="Quantidade"><input required type="number" min="0.001" step="0.001" value={movementQuantity} onChange={(e) => setMovementQuantity(e.target.value)} className={inputClass} /></Field>
                  {movementType === "entrada" && <Field label="Custo unitário da compra (R$)"><input type="number" min="0" step="0.01" value={movementCost} onChange={(e) => setMovementCost(e.target.value)} className={inputClass} /></Field>}
                  <Field label="Fornecedor"><select value={movementSupplier} onChange={(e) => setMovementSupplier(e.target.value)} className={inputClass}><option value="">Não informado</option>{(data?.suppliers ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
                </div>
                {movementType === "saida" && <Field label="Vincular à OS (opcional)"><select value={movementOrder} onChange={(e) => setMovementOrder(e.target.value)} className={inputClass}><option value="">Sem vínculo</option>{(data?.orders ?? []).map((order) => <option key={order.id} value={order.id}>OS {order.number} · {order.customer_name} · {order.plate}</option>)}</select></Field>}
                <Field label="Motivo / observação"><input maxLength={500} value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} className={inputClass} placeholder="Compra, uso interno, devolução…" /></Field>
                {selectedItem && <p className="text-xs text-muted-foreground">Saldo atual: <strong>{selectedItem.stock_quantity} {selectedItem.unit}</strong></p>}
                <Button type="submit" disabled={saving || !data?.items.length}>{movementType === "entrada" ? <ArrowDownToLine /> : <ArrowUpFromLine />}{saving ? "Salvando…" : "Registrar movimentação"}</Button>
              </form>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Catálogo de estoque</h2>
            <div className="overflow-x-auto rounded-md border bg-card">
              <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/60 text-left"><tr><th className="p-3">Produto</th><th className="p-3">Código / marca</th><th className="p-3">Saldo</th><th className="p-3">Mínimo</th><th className="p-3">Custo</th><th className="p-3">Preço</th><th className="p-3">Fornecedor</th></tr></thead><tbody className="divide-y">{(data?.items ?? []).map((item) => <tr key={item.id}><td className="p-3"><strong>{item.name}</strong><p className="text-xs text-muted-foreground">{item.category ?? "Sem categoria"} · {item.location ?? "Sem localização"}</p></td><td className="p-3">{item.code ?? "—"}<p className="text-xs text-muted-foreground">{item.brand ?? "—"}</p></td><td className="p-3 font-semibold">{item.stock_quantity} {item.unit}</td><td className="p-3">{item.minimum_stock}</td><td className="p-3">{formatBRL(Number(item.cost_price))}</td><td className="p-3">{formatBRL(Number(item.sale_price))}</td><td className="p-3">{data?.suppliers.find((supplier) => supplier.id === item.supplier_id)?.name ?? "—"}</td></tr>)}</tbody></table>
              {!data?.items.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</p>}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Movimentações recentes</h2>
            <div className="rounded-md border bg-card divide-y">{(data?.movements ?? []).map((movement) => {
              const item = data?.items.find((entry) => entry.id === movement.item_id);
              return <article key={movement.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><p className="text-sm font-medium">{item?.name ?? "Produto removido"}</p><p className="text-xs text-muted-foreground">{new Date(movement.created_at).toLocaleString("pt-BR")} · {movement.notes || "Sem observação"}</p></div><strong className={movement.movement_type === "entrada" ? "text-emerald-600" : "text-foreground"}>{movement.movement_type === "entrada" ? "+" : "−"}{movement.quantity} {item?.unit ?? ""}</strong></article>;
            })}{!data?.movements.length && <p className="p-5 text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>}</div>
          </section>
        </>
      )}
    </div>
  );
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span className="text-muted-foreground">{label}</span>{children}</label>;
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="rounded-md border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></article>;
}
