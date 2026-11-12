import { describe, expect, it, vi } from "vitest";
import { refreshAuthorization } from "./auth-refresh";

describe("refreshAuthorization", () => {
  it("clears cached account data and invalidates route guards", () => {
    const queryCache = { clear: vi.fn() };
    const router = { invalidate: vi.fn() };

    refreshAuthorization(queryCache, router);

    expect(queryCache.clear).toHaveBeenCalledOnce();
    expect(router.invalidate).toHaveBeenCalledOnce();
  });
});
