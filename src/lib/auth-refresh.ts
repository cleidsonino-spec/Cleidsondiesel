type AuthorizationRouter = { invalidate: () => unknown };
type AuthorizationCache = { clear: () => void };

/**
 * Force active route guards and cached account data to be re-evaluated.
 * Used when the app returns to the foreground, where a role may have changed
 * while this tab or native WebView was inactive.
 */
export function refreshAuthorization(
  queryCache: AuthorizationCache,
  router: AuthorizationRouter,
): void {
  queryCache.clear();
  void router.invalidate();
}
