type AuthRouter = {
  navigate: (options: { to: "/auth"; replace: true }) => unknown;
  invalidate: () => unknown;
};

type AuthQueryCache = {
  clear: () => void;
};

type Schedule = (callback: () => void) => void;

// Prevent a deferred callback from an older auth event from overriding a newer
// identity transition (for example, SIGNED_OUT immediately followed by SIGNED_IN).
let authEventVersion = 0;

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
    const version = ++authEventVersion;
    queryCache.clear();

    if (event === "SIGNED_OUT") {
      schedule(() => {
        if (version !== authEventVersion) return;
        void router.navigate({ to: "/auth", replace: true });
      });
      return;
    }

    schedule(() => {
      if (version !== authEventVersion) return;
      void router.invalidate();
    });
    return;
  }

  if (event === "USER_UPDATED") {
    // A profile update must not cancel a pending SIGNED_OUT redirect.
    // Route invalidation is safe here because the authenticated route guard
    // re-checks the current user with Supabase before rendering protected pages.
    schedule(() => {
      void router.invalidate();
    });
  }
}
