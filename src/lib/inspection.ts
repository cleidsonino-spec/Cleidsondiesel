export const INSPECTION_STATUSES = [
  { value: "pending", label: "Não verificado" },
  { value: "ok", label: "Conforme" },
  { value: "attention", label: "Atenção" },
  { value: "failed", label: "Reprovado" },
  { value: "na", label: "Não se aplica" },
] as const;

export type InspectionItem = { id: string; label: string; status: typeof INSPECTION_STATUSES[number]["value"]; notes: string };

export function newInspection(): InspectionItem[] {
  return ["Vazamentos de combustível", "Bomba injetora", "Bicos injetores", "Filtro de combustível", "Mangueiras e conexões", "Partida do motor", "Fumaça e funcionamento", "Teste de pressão / calibração"].map((label, index) => ({ id: `inspection-${index}`, label, status: "pending", notes: "" }));
}

export function readInspection(value: unknown): InspectionItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.label !== "string") return [];
    const status = INSPECTION_STATUSES.find((s) => s.value === item.status)?.value ?? "pending";
    return [{ id: item.id, label: item.label, status, notes: typeof item.notes === "string" ? item.notes : "" }];
  });
}