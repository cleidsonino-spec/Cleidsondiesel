import { describe, expect, it } from "vitest";
import { matchesTechnicalSearch } from "@/lib/technical-reference";
import { searchCatalog, type TechnicalComponent, type TechnicalReference } from "@/lib/technical-catalog";

const comp = (id: string, code: string, type: string, name = "Bomba"): TechnicalComponent =>
  ({ id, component_code: code, component_type: type, name }) as unknown as TechnicalComponent;
const ref = (componentId: string, code: string): TechnicalReference =>
  ({ component_id: componentId, reference_code: code, notes: null, source_description: null, catalog_position: null }) as unknown as TechnicalReference;
const fields = (c: TechnicalComponent) => [c.name, c.component_code];

describe("busca global da Central Técnica", () => {
  const pump = comp("p1", "0 402 736 841", "bomba_em_linha_p7100");
  const loose = comp("c1", "9 460 000 001", "bico_injetor", "Bico injetor");
  it("prioriza bombas completas antes de componentes avulsos", () => {
    const result = searchCatalog([loose, comp("c2", "0 460 414 999", "bomba_rotativa_ve"), pump], [], "bomba", fields);
    expect(result.map(c => c.id)).toEqual(["p1", "c2"]);
  });
  it("inclui componente avulso quando o termo só bate nele", () => {
    const result = searchCatalog([pump, loose], [], "bico", fields);
    expect(result.map(c => c.id)).toEqual(["c1"]);
  });
  it("código de peça localiza a bomba que a contém", () => {
    const result = searchCatalog([pump], [ref("p1", "1 417 010 003")], "1417010003", fields);
    expect(result.map(c => c.id)).toEqual(["p1"]);
  });
  it("não duplica registro achado pelo próprio código e por peça", () => {
    const result = searchCatalog([pump], [ref("p1", "0 402 736 841")], "0402736841", fields);
    expect(result).toHaveLength(1);
  });
  it("busca vazia não retorna nada", () => {
    expect(searchCatalog([pump], [], "  ", fields)).toHaveLength(0);
  });
});
describe("busca técnica", () => {
  it("acha código com ou sem espaços", () => {
    expect(matchesTechnicalSearch(["0 460 414 999"], "0460414999")).toBe(true);
    expect(matchesTechnicalSearch(["0460414999"], "0 460 414 999")).toBe(true);
  });
  it("aceita busca parcial", () => expect(matchesTechnicalSearch(["294000-001#"], "294000")).toBe(true));
  it("combina palavras em campos diferentes", () => expect(matchesTechnicalSearch(["Bosch", "Bomba VE"], "bomba bosch")).toBe(true));
  it("não acha termo ausente", () => expect(matchesTechnicalSearch(["Delphi"], "denso")).toBe(false));
});
