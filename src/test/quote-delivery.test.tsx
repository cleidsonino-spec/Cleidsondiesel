import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";

const mocks = vi.hoisted(() => ({ create: vi.fn(), save: vi.fn(), share: vi.fn(), canShare: vi.fn() }));
vi.mock("@/lib/quote-pdf", () => ({ createQuotePdf: mocks.create, defaultQuotePdfOptions: { validityDays: 7, paymentTerms: "", paymentMethods: "", serviceConditions: "", observations: "" } }));
vi.mock("@/lib/quote-delivery", () => ({ saveQuote: mocks.save, shareQuote: mocks.share, canShareQuote: mocks.canShare }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) } } }));
import { QuotePdfActions } from "@/components/painel/quote-pdf-actions";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];
const order = { id: "test", number: 10, customer_name: "Cliente fictício", phone: "71986571661", updated_at: "v1" } as Order;
const pdf = new File(["%PDF-1.4 test"], "orcamento.pdf", { type: "application/pdf" });

beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue(pdf); mocks.save.mockResolvedValue(undefined); mocks.share.mockResolvedValue(undefined); mocks.canShare.mockReturnValue(true); });
afterEach(cleanup);

describe("PDF atualizado do orçamento", () => {
  it("baixa o arquivo preparado diretamente", async () => {
    render(<QuotePdfActions order={order} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Baixar PDF atualizado" }).hasAttribute("disabled")).toBe(false));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Baixar PDF atualizado" })));
    expect(mocks.save).toHaveBeenCalledWith(pdf);
  });

  it("envia mensagem digitada e PDF juntos pelo compartilhamento", async () => {
    render(<QuotePdfActions order={order} message="Orçamento atualizado: R$ 500" />);
    const button = screen.getByRole("button", { name: "Enviar orçamento pelo WhatsApp" });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    await act(async () => fireEvent.click(button));
    expect(mocks.share).toHaveBeenCalledWith(pdf, expect.any(String), expect.stringContaining("Orçamento atualizado: R$ 500"));
  });

  it("impede compartilhar o arquivo anterior enquanto regenera após atualização", async () => {
    const { rerender } = render(<QuotePdfActions order={order} />);
    const button = screen.getByRole("button", { name: "Compartilhar PDF com o cliente" });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    let resolve: (file: File) => void = () => undefined;
    mocks.create.mockImplementation(() => new Promise<File>((done) => { resolve = done; }));
    rerender(<QuotePdfActions order={{ ...order, updated_at: "v2" }} />);
    expect(button.hasAttribute("disabled")).toBe(true);
    const updated = new File(["%PDF-1.4 updated"], "novo.pdf", { type: "application/pdf" });
    await act(async () => resolve(updated));
    await act(async () => fireEvent.click(button));
    expect(mocks.share).toHaveBeenCalledWith(updated, expect.any(String), expect.any(String));
  });

  it("não regenera por simples troca de referência do mesmo pedido", async () => {
    const { rerender } = render(<QuotePdfActions order={order} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Compartilhar PDF com o cliente" }).hasAttribute("disabled")).toBe(false));
    const calls = mocks.create.mock.calls.length;
    rerender(<QuotePdfActions order={{ ...order }} />);
    expect(mocks.create).toHaveBeenCalledTimes(calls);
  });
});