import type { Database } from "@/integrations/supabase/types";
import { readPartMetadata, type PartDraft } from "./parts";
type Tables = Database["public"]["Tables"];
export type TechnicalComponent = Tables["technical_components"]["Row"] & { technical_manufacturers?: { name: string } | null; technical_categories?: { name: string } | null };
export type TechnicalReference = Tables["technical_references"]["Row"] & { technical_manufacturers?: { name: string } | null };
export type TechnicalDocument = Tables["technical_documents"]["Row"];
export type TechnicalHotspot = Tables["technical_figure_hotspots"]["Row"];

export function safeSource(url: string | null | undefined): string | undefined {
  try { const parsed = new URL(url ?? ""); return parsed.protocol === "https:" ? parsed.href : undefined; } catch { return undefined; }
}
/** Public access is not a licence to reproduce a restricted catalog. No proxy or download fallback. */
export function canEmbedDocument(document: TechnicalDocument): boolean {
  return document.is_active && document.access_type === "public" && Boolean(safeSource(document.source_url))
    && !/somente refer[eê]ncia|somente.*metadados|sem reproduzir|n[aã]o.*(copiar|reproduzir|incorporar)|restrito/i.test(document.copyright_notes ?? "");
}
export function validHotspotBounds(h: Pick<TechnicalHotspot, "x" | "y" | "width" | "height" | "shape" | "pdf_page_number">): boolean {
  return [h.x, h.y, h.width, h.height].every(Number.isFinite) && h.x >= 0 && h.y >= 0 && h.width > 0 && h.height > 0
    && h.x + h.width <= 1 && h.y + h.height <= 1 && ["rect", "circle"].includes(h.shape)
    && Number.isInteger(h.pdf_page_number) && h.pdf_page_number > 0;
}
export function validHotspotLinks(h: TechnicalHotspot, reference: TechnicalReference | undefined, document: TechnicalDocument | undefined): boolean {
  return Boolean(reference && document && h.reference_id === reference.id && h.component_id === reference.component_id
    && h.document_id === document.id && document.component_id === h.component_id);
}
export function consultableHotspot(h: TechnicalHotspot, references: TechnicalReference[], documents: TechnicalDocument[]): boolean {
  const r = references.find(r => r.id === h.reference_id);
  const d = documents.find(d => d.id === h.document_id);
  return h.is_active && h.information_status === "documented" && r?.information_status === "documented"
    && d?.information_status === "documented" && d.is_active && validHotspotLinks(h, r, d) && validHotspotBounds(h);
}
export function pageHotspots(hotspots: TechnicalHotspot[], documentId: string, page: number): TechnicalHotspot[] {
  return hotspots.filter(h => h.document_id === documentId && h.pdf_page_number === page && validHotspotBounds(h));
}
export function coverageLabel(refs: TechnicalReference[], docs: TechnicalDocument[], hotspots: TechnicalHotspot[]): string {
  if (hotspots.some(h => consultableHotspot(h, refs, docs) && docs.some(d => d.id === h.document_id && canEmbedDocument(d)))) return "Figura interativa validada";
  return refs.length ? "Referências disponíveis — figura ainda não mapeada" : "Aguardando documentação";
}
export function referenceDescription(r: TechnicalReference): string {
  const notes = r.notes ?? "";
  const translated = notes.match(/designação traduzida\s*:\s*([^.\n|]+)/i)?.[1]?.trim();
  const positional = notes.match(/(?:^|\n)Posição\s+[^—\n]+—\s*([^.;\n]+)/i)?.[1]?.trim();
  const sourceDesignation = notes.match(/(?:^|[;\n])\s*Designação:\s*([^;\n]+)/i)?.[1]?.trim();
  // Catalog imports often store the actual part name in notes ("Posição 50 — pistão de avanço").
  // Prefer that per-item designation over source_description, which may only describe the catalog.
  return translated || positional || sourceDesignation || r.source_description || `Peça ${r.reference_code}`;
}
export function referencePart(r: TechnicalReference, component: TechnicalComponent, document?: TechnicalDocument): PartDraft {
  const quantity = r.information_status === "documented" && Number.isInteger(r.catalog_quantity) && Number(r.catalog_quantity) > 0 ? String(r.catalog_quantity) : "1";
  return { description: referenceDescription(r), quantity, unit_value: "", ...readPartMetadata({ code: r.reference_code,
    manufacturer: r.technical_manufacturers?.name, technical_reference_id: r.id, technical_component_id: component.id,
    catalog_position: r.catalog_position ?? undefined, technical_document_id: document?.id,
    source_url: safeSource(document?.source_url ?? r.source_url) }) };
}