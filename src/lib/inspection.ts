export type InspectionData = {
  failedItems: string;
  observations: string;
};

/** Lê o formato atual e mantém compatibilidade com checklists gravados em OS antigas. */
export function readInspectionData(value: unknown): InspectionData {
  if (Array.isArray(value)) {
    const failedItems: string[] = [];
    const observations: string[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;

      // Formato atual: array exigido pela constraint do banco, com campos separados.
      if (item['id'] === "failed-items") {
        const text = typeof item['notes'] === "string" ? item['notes'] : item['label'];
        if (typeof text === "string" && text.trim()) failedItems.push(text.trim());
        continue;
      }
      if (item['id'] === "inspection-observations") {
        if (typeof item['notes'] === "string" && item['notes'].trim()) observations.push(item['notes'].trim());
        continue;
      }

      // Compatibilidade com o checklist antigo.
      if (typeof item['label'] !== "string") continue;
      if (item['status'] === "failed") failedItems.push(item['label']);
      if (typeof item['notes'] === "string" && item['notes'].trim()) {
        observations.push(`${item['label']}: ${item['notes'].trim()}`);
      }
    }
    return { failedItems: failedItems.join("\n"), observations: observations.join("\n") };
  }

  // Compatibilidade temporária com registros que tenham sido gravados como objeto.
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    return {
      failedItems: typeof data['failedItems'] === "string" ? data['failedItems'] : "",
      observations: typeof data['observations'] === "string" ? data['observations'] : "",
    };
  }

  return { failedItems: "", observations: "" };
}

/** Persiste como array porque service_orders_inspection_array exige jsonb_typeof(...) = 'array'. */
export function writeInspectionData(data: InspectionData) {
  const failedItems = data.failedItems.trim();
  const observations = data.observations.trim();
  return [
    ...(failedItems ? [{ id: "failed-items", label: "Itens reprovados", status: "failed", notes: failedItems }] : []),
    ...(observations ? [{ id: "inspection-observations", label: "Observações da inspeção", status: "pending", notes: observations }] : []),
  ];
}
