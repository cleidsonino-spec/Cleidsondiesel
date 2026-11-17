import { describe, expect, it } from "vitest";
import { matchesPumpReference, normalizePumpReference } from "@/lib/technical-reference";
import { referenceDescription, type TechnicalReference } from "@/lib/technical-catalog";

describe("referência da bomba rotativa VE", () => {
  it("normaliza referência com espaços", () => {
    expect(normalizePumpReference("0 460 424 232")).toBe("0460424232");
  });

  it("aceita somente correspondência exata de dez dígitos", () => {
    expect(matchesPumpReference("Bosch VE 0 460 424 232", "0460424232")).toBe(true);
    expect(matchesPumpReference("Bosch VE 0 460 424 232", "0460")).toBe(false);
    expect(matchesPumpReference("Bosch VE 0 460 424 272", "0460424232")).toBe(false);
    expect(matchesPumpReference(null, "0460424232")).toBe(false);
  });

  it("não considera uma entrada incompleta como referência válida", () => {
    expect(matchesPumpReference("Bosch VE 0 460 424 232", "046042")).toBe(false);
  });
});


describe("descrição das peças do catálogo técnico", () => {
  const reference = (notes: string, source_description = "Catálogo Bosch — tabela de peças") =>
    ({ notes, source_description, reference_code: "9 461 615 070" }) as unknown as TechnicalReference;

  it("prioriza a designação da posição em vez da descrição genérica da fonte", () => {
    expect(referenceDescription(reference("Posição 50 — pistão de avanço. Código transcrito da coluna 50.")))
      .toBe("pistão de avanço");
  });

  it("distingue pistão de avanço de corpo do distribuidor", () => {
    expect(referenceDescription(reference("Posição 50 — pistão de avanço."))).toBe("pistão de avanço");
    expect(referenceDescription(reference("Posição 50/804 — corpo do distribuidor."))).toBe("corpo do distribuidor");
  });
});
