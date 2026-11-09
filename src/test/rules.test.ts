import { describe, expect, it } from "vitest";
import { readInspectionData, writeInspectionData } from "@/lib/inspection";
import { diagnosisText, inspectionDiagnosisInput } from "@/lib/inspection-diagnosis";
import { parseMoney, partsTotal, draftPartItems, readPartItems } from "@/lib/parts";
import { quoteRows } from "@/lib/quote-pdf";
import { approvalUrl } from "@/lib/approval";
import { isFullName, isValidCpf } from "@/lib/customer-identity";
import { formatPlate, isValidPlate, normalizePlate } from "@/lib/plate";
import { availableSlots, getSlotsForDate } from "@/lib/schedule";
import { orderTotal } from "@/lib/status";
import { quoteMessage, toWhatsAppNumber, SHOP_WHATSAPP, appointmentShopLink, approvalShopLink } from "@/lib/whatsapp";

describe("inspeção", () => {
  it("preserva itens reprovados e observações do mecânico", () => {
    const stored = writeInspectionData({ failedItems: "Bomba", observations: "Vazamento de combustível" });
    expect(readInspectionData(stored)).toEqual({ failedItems: "Bomba", observations: "Vazamento de combustível" });
  });
  it("exige itens reprovados ou observações antes de gerar diagnóstico", () => {
    const input = { vehicle: "Hilux", vehicle_year: "2015", complaint: "", failed_items: "", observations: "" };
    expect(inspectionDiagnosisInput.safeParse(input).success).toBe(false);
    expect(inspectionDiagnosisInput.safeParse({ ...input, failed_items: "Bomba: vazamento" }).success).toBe(true);
    expect(inspectionDiagnosisInput.safeParse({ ...input, observations: "Pressão abaixo do especificado" }).success).toBe(true);
  });
  it("diagnóstico aplicado mantém o texto recebido", () => {
    expect(diagnosisText({ diagnosis: "Vazamento observado. Reparar após avaliação. Testar pressão." }))
      .toBe("Vazamento observado. Reparar após avaliação. Testar pressão.");
  });
  it("não inventa resultados ao ler checklist antigo", () => {
    expect(readInspectionData(null)).toEqual({ failedItems: "", observations: "" });
    expect(readInspectionData([{ id: "old", label: "Bomba", status: "pending" }]))
      .toEqual({ failedItems: "", observations: "" });
    expect(readInspectionData([{ id: "old", label: "Bomba", status: "failed", notes: "Vazamento" }]))
      .toEqual({ failedItems: "Bomba", observations: "Bomba: Vazamento" });
  });
});

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
  it("aprovação exige nome completo, não apenas primeiro nome", () => {
    expect(isFullName("João Silva")).toBe(true);
    expect(isFullName("João")).toBe(false);
    expect(isFullName("João 123")).toBe(false);
  });
  it("aprovação exige CPF com dígitos verificadores válidos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("PDF mantém quantidade e valores individuais das peças e mão de obra", () => {
    expect(quoteRows({ part_items: [
      { description: "Kit", quantity: 1, unit_value: 125.50, value: 125.50 },
      { description: "Bico", quantity: 1, unit_value: 250.25, value: 250.25 },
    ], parts_value: 375.75, labor_value: 100 })).toEqual([
      { description: "Kit", quantity: 1, unit_value: 125.50, value: 125.50 },
      { description: "Bico", quantity: 1, unit_value: 250.25, value: 250.25 },
      { description: "Mão de obra", quantity: 1, unit_value: 100, value: 100 },
    ]);
  });
  it("soma peças em centavos e recalcula ao remover", () => {
    const items = draftPartItems([
      { description: "Kit", quantity: "1", unit_value: "125,50" },
      { description: "Bico", quantity: "1", unit_value: "250,25" },
      { description: "", quantity: "1", unit_value: "" },
    ]);
    expect(partsTotal(items)).toBe(375.75);
    expect(partsTotal(items.slice(1))).toBe(250.25);
    expect(partsTotal(readPartItems([{ description: "A", value: 0.1 }, { description: "B", value: 0.2 }]))).toBe(0.3);
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
      number: 12, plate: "ABC1D23", customer_name: "João Silva", vehicle: "Hilux",
      status: "aguardando_aprovacao", complaint: "Fumaça", diagnosis: null, parts: null,
      parts_value: 1000, labor_value: 500, due_date: null,
    });
    expect(msg).toContain("OS nº 12");
    expect(msg).toMatch(/Total: R\\$[\\s\\u00a0]?1\\.500,00/);
  });
});

describe("WhatsApp", () => {
  it("encaminha o agendamento para o WhatsApp 71986571661", () => {
    const link = appointmentShopLink({ name: "João Silva", date: "2026-11-09", time: "09:00", plate: "ABC1234", vehicle: "Hilux", service: "Bomba injetora" });
    expect(link && new URL(link).pathname).toBe("/5571986571661");
  });
  it("encaminha a aprovação para o WhatsApp 71986571661 sem CPF ou token", () => {
    const link = approvalShopLink({ number: 12, plate: "ABC1234", vehicle: "Hilux" }, "João Silva");
    expect(link && new URL(link).pathname).toBe("/5571986571661");
    expect(link && [...new URL(link).searchParams.keys()]).toEqual(["text"]);
  });
  it("link de aprovação abre o orçamento privado no site", () => {
    const token = "a".repeat(64);
    expect(approvalUrl(token)).toBe(`https://cleidsondiesel.lovable.app/orcamento/${token}`);
    expect(() => approvalUrl("ABC1234")).toThrow();
  });
  it("usa o número informado pelo dono", () => {
    expect(SHOP_WHATSAPP?.split("?")[0]).toBe("https://wa.me/5571986571661");
  });
  it("adiciona código do Brasil", () => {
    expect(toWhatsAppNumber("(71) 99999-0000")).toBe("5571999990000");
    expect(toWhatsAppNumber("+55 71 99999-0000")).toBe("5571999990000");
    expect(toWhatsAppNumber("1234")).toBeNull();
  });
});
