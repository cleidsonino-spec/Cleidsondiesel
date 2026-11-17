import { supabase } from "@/integrations/supabase/client";
import type { PartDraft } from "@/lib/parts";

export type MaterialListItem = {
  id: string;
  list_id: string;
  technical_reference_id: string | null;
  technical_component_id: string | null;
  reference_code: string;
  description: string;
  manufacturer: string | null;
  pump_code: string | null;
  catalog_position: string | null;
  quantity_needed: number;
  notes: string | null;
};

export type MaterialList = {
  id: string;
  title: string;
  status: "draft" | "finalized";
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  material_list_items: MaterialListItem[];
};

export async function addPartToMaterialList(part: PartDraft, pumpCode: string, quantity: number) {
  if (!part.description.trim() || !part.code?.trim()) {
    throw new Error("A peça precisa ter descrição e código para entrar na lista.");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    throw new Error("Informe uma quantidade válida.");
  }

  const { data, error } = await (supabase as any).rpc("add_material_list_item", {
    _technical_reference_id: part.technical_reference_id || null,
    _technical_component_id: part.technical_component_id || null,
    _reference_code: part.code.trim(),
    _description: part.description.trim(),
    _manufacturer: part.manufacturer || null,
    _pump_code: pumpCode || null,
    _catalog_position: part.catalog_position || null,
    _quantity: quantity,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchMaterialLists(): Promise<MaterialList[]> {
  const { data, error } = await (supabase as any)
    .from("material_lists")
    .select("*,material_list_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaterialList[];
}

export async function saveMaterialList(listId: string) {
  const { error } = await (supabase as any)
    .from("material_lists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", listId)
    .eq("status", "draft");
  if (error) throw error;
}

export async function finalizeMaterialList(listId: string) {
  const db = supabase as any;
  const { count, error: countError } = await db
    .from("material_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId);
  if (countError) throw countError;
  if (!count) throw new Error("Adicione pelo menos uma peça antes de finalizar.");

  const { error } = await db
    .from("material_lists")
    .update({ status: "finalized", finalized_at: new Date().toISOString() })
    .eq("id", listId)
    .eq("status", "draft");
  if (error) throw error;
}
