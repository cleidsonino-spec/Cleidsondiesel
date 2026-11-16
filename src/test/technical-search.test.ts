import { describe, expect, it } from "vitest";
import { matchesTechnicalSearch } from "@/lib/technical-reference";
describe("busca técnica", () => {
  it("acha código com ou sem espaços", () => {
    expect(matchesTechnicalSearch(["0 460 414 999"], "0460414999")).toBe(true);
    expect(matchesTechnicalSearch(["0460414999"], "0 460 414 999")).toBe(true);
  });
  it("aceita busca parcial", () => expect(matchesTechnicalSearch(["294000-001#"], "294000")).toBe(true));
  it("combina palavras em campos diferentes", () => expect(matchesTechnicalSearch(["Bosch", "Bomba VE"], "bomba bosch")).toBe(true));
  it("não acha termo ausente", () => expect(matchesTechnicalSearch(["Delphi"], "denso")).toBe(false));
});
