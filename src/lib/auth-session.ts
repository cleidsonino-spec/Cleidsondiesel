type AuthRouter = {
  navigate: (options: { to: "/auth"; replace: true }) => unknown;
  invalidate: () => unknown;
};

type AuthQueryCache = {
  clear: () => void;
};

/**
 * Keep client-side data and route state aligned with the active Supabase identity.
 * A signed-out event covers both explicit logout and remotely invalidated sessions.
 */
export function handleAuthStateChange(
  event: string,
  queryCache: AuthQueryCache,
  router: AuthRouter,
): void {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    queryCache.clear();

    if (event === "SIGNED_OUT") {
      void router.navigate({ to: "/auth", replace: true });
      return;
    }

    void router.invalidate();
    return;
  }

  if (event === "USER_UPDATED") void router.invalidate();
}
