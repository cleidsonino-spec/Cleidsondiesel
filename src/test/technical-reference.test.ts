import { describe, expect, it } from "vitest";
import { matchesPumpReference, normalizePumpReference } from "@/lib/technical-reference";

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
