import { describe, expect, it } from "vitest";

import { parseMoney, partsTotal, draftPartItems } from "@/lib/parts";
import { formatPlate, isValidPlate, normalizePlate } from "@/lib/plate";
import { availableSlots, getSlotsForDate } from "@/lib/schedule";
import { orderTotal } from "@/lib/status";
import { quoteMessage, toWhatsAppNumber, SHOP_WHATSAPP } from "@/lib/whatsapp";

describe("placas", () => {
  it("aceita placa antiga e Mercosul, com ou sem traço", () => {
    expect(isValidPlate("abc-1234")).toBe(true);
    expect(isValidPlate("ABC1D23")).toBe(true);
    expect(isValidPlate("AB12345")).toBe(false);
  });
  it("normaliza e formata", () => {
    expect(normalizePlate("abc-1234")).toBe("ABC1234");
    expect(formatPlate("abc1234")).toBe("ABC-1234");
    expect(formatPlate("abc1d23")).toBe("ABC1D23");
  });
});

describe("horários", () => {
  it("domingo fechado", () => {
    expect(getSlotsForDate("2026-11-08")).toEqual([]);
  });
  it("sábado fechado", () => {
    expect(getSlotsForDate("2026-11-07")).toEqual([]);
  });
  it("dia útil sem horário de almoço", () => {
    const slots = getSlotsForDate("2026-11-09");
    expect(slots).not.toContain("12:00");
    expect(slots[0]).toBe("08:00");
    expect(slots.at(-1)).toBe("17:00");
  });
  it("remove horários ocupados", () => {
    expect(availableSlots("2026-11-09", ["09:00:00"])).toEqual(["08:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
  });
});

describe("orçamento", () => {
  it("soma todas as peças em centavos e recalcula ao remover", () => {
    const items = draftPartItems([{ description: "Kit", value: "125,50" }, { description: "Bico", value: "250,25" }, { description: "", value: "" }]);
    expect(partsTotal(items)).toBe(375.75);
    expect(partsTotal(items.slice(1))).toBe(250.25);
    expect(partsTotal([{ description: "A", value: 0.1 }, { description: "B", value: 0.2 }])).toBe(0.3);
  });
  it("total = peças + mão de obra", () => {
    expect(orderTotal(1250.5, "300")).toBe(1550.5);
  });
  it("lê valores em reais", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("350")).toBe(350);
  });
  it("mensagem de orçamento traz o total", () => {
    const msg = quoteMessage({
      number: 12,
      plate: "ABC1D23",
      customer_name: "João Silva",
      vehicle: "Hilux",
      status: "aguardando_aprovacao",
      complaint: "Fumaça",
      diagnosis: null,
      parts: null,
      parts_value: 1000,
      labor_value: 500,
      due_date: null,
    });
    expect(msg).toContain("OS nº 12");
    expect(msg).toMatch(/Total: R\$\s?1\.500,00/);
  });
});

describe("WhatsApp", () => {
  it("usa o número informado pelo dono", () => {
    expect(SHOP_WHATSAPP?.split("?")[0]).toBe("https://wa.me/5571986571661");
  });
  it("adiciona código do Brasil", () => {
    expect(toWhatsAppNumber("(71) 99999-0000")).toBe("5571999990000");
    expect(toWhatsAppNumber("+55 71 99999-0000")).toBe("5571999990000");
    expect(toWhatsAppNumber("1234")).toBeNull();
  });
});
