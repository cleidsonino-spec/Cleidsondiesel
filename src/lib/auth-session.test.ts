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


  it("ignores a stale sign-out redirect after a newer sign-in", () => {
    const first = setup();
    const second = setup();
    const scheduled: Array<() => void> = [];

    handleAuthStateChange("SIGNED_OUT", first.queryCache, first.router, (callback) => {
      scheduled.push(callback);
    });
    handleAuthStateChange("SIGNED_IN", second.queryCache, second.router, (callback) => {
      scheduled.push(callback);
    });

    scheduled[0]();
    scheduled[1]();

    expect(first.router.navigate).not.toHaveBeenCalled();
    expect(second.router.invalidate).toHaveBeenCalledOnce();
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
