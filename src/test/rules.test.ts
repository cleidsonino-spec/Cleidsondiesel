import { describe, expect, it } from "vitest";
import { readInspectionData, writeInspectionData } from "@/lib/inspection";
import { inspectionDiagnosisInput } from "@/lib/inspection-diagnosis";

describe("inspeção", () => {
  it("preserva itens reprovados e observações", () => {
    const data = { failedItems: "Bomba com vazamento", observations: "Pressão baixa" };
    expect(readInspectionData(writeInspectionData(data))).toEqual(data);
  });
  it("mantém achados dos checklists antigos", () => {
    expect(readInspectionData([{ label: "Bomba", status: "failed", notes: "Vazamento" }])).toEqual({ failedItems: "Bomba", observations: "Bomba: Vazamento" });
    expect(readInspectionData(null)).toEqual({ failedItems: "", observations: "" });
  });
  it("exige achados ou observações para IA", () => {
    const input = { vehicle: "Hilux", vehicle_year: "2015", complaint: "", failed_items: "", observations: "" };
    expect(inspectionDiagnosisInput.safeParse(input).success).toBe(false);
    expect(inspectionDiagnosisInput.safeParse({ ...input, failed_items: "Vazamento" }).success).toBe(true);
  });
});

import { parseMoney, partsTotal, draftPartItems } from "@/lib/parts";
import { quoteRows } from "@/lib/quote-pdf";
import { approvalUrl } from "@/lib/approval";
import { isFullName, isValidCpf } from "@/lib/customer-identity";
import { formatPlate, isValidPlate, normalizePlate } from "@/lib/plate";
import { availableSlots, getSlotsForDate } from "@/lib/schedule";
import { orderTotal } from "@/lib/status";
import { canIssueWarranty, warrantyEndDate, warrantyState } from "@/lib/warranty";
import { quoteMessage, toWhatsAppNumber, SHOP_WHATSAPP, appointmentShopLink, approvalShopLink } from "@/lib/whatsapp";
import { remainingOrderBalance } from "@/lib/financial";

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
  it("PDF mantém os valores individuais das peças e mão de obra", () => {
    expect(quoteRows({ part_items: [{ description: "Kit", value: 125.50 }, { description: "Bico", value: 250.25 }], parts_value: 375.75, labor_value: 100 })).toEqual([{ description: "Kit", value: 125.50 }, { description: "Bico", value: 250.25 }, { description: "Mão de obra", value: 100 }]);
  });
  it("soma todas as peças em centavos e recalcula ao remover", () => {
    const items = draftPartItems([{ description: "Kit", quantity: "1", unit_value: "125,50" }, { description: "Bico", quantity: "1", unit_value: "250,25" }, { description: "", quantity: "1", unit_value: "" }]);
    expect(partsTotal(items)).toBe(375.75);
    expect(partsTotal(items.slice(1))).toBe(250.25);
    expect(partsTotal([{ description: "A", quantity: 1, unit_value: 0.1, value: 0.1 }, { description: "B", quantity: 1, unit_value: 0.2, value: 0.2 }])).toBe(0.3);
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


describe("garantia", () => {
  it("só permite emitir quando a OS está pronta para retirada", () => {
    expect(canIssueWarranty("pronto")).toBe(true);
    for (const status of ["recebido", "em_analise", "aguardando_aprovacao", "em_servico", "entregue", "cancelado"]) {
      expect(canIssueWarranty(status)).toBe(false);
    }
  });
  it("calcula vencimento por mês-calendário, ajustando fim de mês e ano bissexto", () => {
    expect(warrantyEndDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(warrantyEndDate("2024-01-31", 1)).toBe("2024-02-29");
    expect(warrantyEndDate("2026-11-30", 3)).toBe("2027-02-28");
  });
  it("classifica garantias futuras, vigentes e vencidas", () => {
    expect(warrantyState("2026-12-01", "2027-12-01", "2026-11-09")).toBe("A iniciar");
    expect(warrantyState("2026-01-01", "2026-12-01", "2026-11-09")).toBe("Vigente");
    expect(warrantyState("2025-01-01", "2025-12-31", "2026-11-09")).toBe("Vencida");
  });
});

describe("contas a receber", () => {
  it("calcula saldo após pagamento parcial", () => {
    expect(remainingOrderBalance(100, 50, [25], "pronto")).toBe(125);
  });
  it("zera saldo após pagamento integral ou superior ao total", () => {
    expect(remainingOrderBalance(100, 50, [150], "pronto")).toBe(0);
    expect(remainingOrderBalance(100, 50, [80, 70], "pronto")).toBe(0);
  });
  it("não cria recebível para OS cancelada", () => {
    expect(remainingOrderBalance(100, 50, [0], "cancelado")).toBe(0);
  });
  it("calcula centavos sem erro de ponto flutuante", () => {
    expect(remainingOrderBalance(0.1, 0.2, [0.1], "em_servico")).toBe(0.2);
  });
  it("ignora pagamentos inválidos e não aceita total negativo", () => {
    expect(remainingOrderBalance(-20, 10, [Number.NaN, -5], "em_servico")).toBe(0);
  });
});
