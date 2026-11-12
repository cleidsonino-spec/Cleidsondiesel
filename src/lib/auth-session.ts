type AuthRouter = {
  navigate: (options: { to: "/auth"; replace: true }) => unknown;
  invalidate: () => unknown;
};

type AuthQueryCache = {
  clear: () => void;
};

type Schedule = (callback: () => void) => void;

/**
 * Keep client-side data and route state aligned with the active Supabase identity.
 * Defer router work until after the auth callback returns to avoid re-entering
 * Supabase while its auth-state lock may still be held.
 */
export function handleAuthStateChange(
  event: string,
  queryCache: AuthQueryCache,
  router: AuthRouter,
  schedule: Schedule = (callback) => {
    setTimeout(callback, 0);
  },
): void {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    queryCache.clear();

    if (event === "SIGNED_OUT") {
      schedule(() => {
        void router.navigate({ to: "/auth", replace: true });
      });
      return;
    }

    schedule(() => {
      void router.invalidate();
    });
    return;
  }

  if (event === "USER_UPDATED") {
    schedule(() => {
      void router.invalidate();
    });
  }
}
