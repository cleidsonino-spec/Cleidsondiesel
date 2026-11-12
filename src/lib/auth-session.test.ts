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
  it("clears cached data and replaces the route on sign out", () => {
    const { queryCache, router } = setup();

    handleAuthStateChange("SIGNED_OUT", queryCache, router);

    expect(queryCache.clear).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true });
    expect(router.invalidate).not.toHaveBeenCalled();
  });

  it("clears cached data and invalidates routes on sign in", () => {
    const { queryCache, router } = setup();

    handleAuthStateChange("SIGNED_IN", queryCache, router);

    expect(queryCache.clear).toHaveBeenCalledOnce();
    expect(router.invalidate).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("invalidates routes when the user profile changes", () => {
    const { queryCache, router } = setup();

    handleAuthStateChange("USER_UPDATED", queryCache, router);

    expect(queryCache.clear).not.toHaveBeenCalled();
    expect(router.invalidate).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does nothing for unrelated auth events", () => {
    const { queryCache, router } = setup();

    handleAuthStateChange("TOKEN_REFRESHED", queryCache, router);

    expect(queryCache.clear).not.toHaveBeenCalled();
    expect(router.invalidate).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
