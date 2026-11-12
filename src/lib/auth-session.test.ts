import { describe, expect, it, vi } from "vitest";

import { handleAuthStateChange } from "./auth-session";

function setup() {
  return {
    queryCache: { clear: vi.fn() },
    router: {
      navigate: vi.fn(),
      invalidate: vi.fn(),
    },
  };
}

describe("handleAuthStateChange", () => {
  it("clears cached data immediately and defers the sign-out redirect", () => {
    const { queryCache, router } = setup();
    let scheduled: (() => void) | undefined;

    handleAuthStateChange("SIGNED_OUT", queryCache, router, (callback) => {
      scheduled = callback;
    });

    expect(queryCache.clear).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(scheduled).toBeTypeOf("function");

    scheduled?.();

    expect(router.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true });
    expect(router.invalidate).not.toHaveBeenCalled();
  });

  it("clears cached data and defers route invalidation on sign in", () => {
    const { queryCache, router } = setup();
    let scheduled: (() => void) | undefined;

    handleAuthStateChange("SIGNED_IN", queryCache, router, (callback) => {
      scheduled = callback;
    });

    expect(queryCache.clear).toHaveBeenCalledOnce();
    expect(router.invalidate).not.toHaveBeenCalled();

    scheduled?.();

    expect(router.invalidate).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("defers route invalidation when the user profile changes", () => {
    const { queryCache, router } = setup();
    let scheduled: (() => void) | undefined;

    handleAuthStateChange("USER_UPDATED", queryCache, router, (callback) => {
      scheduled = callback;
    });

    expect(queryCache.clear).not.toHaveBeenCalled();
    expect(router.invalidate).not.toHaveBeenCalled();

    scheduled?.();

    expect(router.invalidate).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does nothing for unrelated auth events", () => {
    const { queryCache, router } = setup();
    const schedule = vi.fn();

    handleAuthStateChange("TOKEN_REFRESHED", queryCache, router, schedule);

    expect(queryCache.clear).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    expect(router.invalidate).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
