export type InspectionData = {
  failedItems: string;
  observations: string;
};

/** Lê o formato novo e mantém compatibilidade com checklists gravados em OS antigas. */
export function readInspectionData(value: unknown): InspectionData {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const data = value as Record<string, unknown>;
    return {
      failedItems: typeof data.failedItems === "string" ? data.failedItems : "",
      observations: typeof data.observations === "string" ? data.observations : "",
    };
  }

  if (Array.isArray(value)) {
    const failedItems: string[] = [];
    const observations: string[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      if (typeof item.label !== "string") continue;
      if (item.status === "failed") failedItems.push(item.label);
      if (typeof item.notes === "string" && item.notes.trim()) {
        observations.push(`${item.label}: ${item.notes.trim()}`);
      }
    }
    return { failedItems: failedItems.join("\n"), observations: observations.join("\n") };
  }

  return { failedItems: "", observations: "" };
}

export function writeInspectionData(data: InspectionData) {
  return {
    failedItems: data.failedItems.trim(),
    observations: data.observations.trim(),
  };
}
