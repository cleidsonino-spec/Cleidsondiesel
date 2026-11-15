import { afterEach, expect, it, vi } from "vitest";
import { downloadQuote } from "@/lib/quote-pdf";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("inicia download no clique, remove o link e mantém URL por 60 segundos", () => {
  vi.useFakeTimers();
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  downloadQuote(new File(["%PDF-1.4"], "orcamento.pdf", { type: "application/pdf" }));
  expect(click).toHaveBeenCalledOnce();
  expect(document.querySelector('a[download="orcamento.pdf"]')).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
  vi.advanceTimersByTime(60_000);
  expect(revoke).toHaveBeenCalledWith("blob:test");
});

it("recusa arquivo vazio em vez de iniciar download inválido", () => {
  expect(() => downloadQuote(new File([], "vazio.pdf", { type: "application/pdf" }))).toThrow();
});