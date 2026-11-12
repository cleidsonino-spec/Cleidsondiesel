export type RoleHomePath = "/equipe" | "/painel";

/**
 * Resolve the initial route from every role assigned to the authenticated user.
 * Admin access takes precedence; otherwise staff accounts use the team workspace.
 */
export function getRoleHomePath(roles: readonly string[]): RoleHomePath {
  if (roles.includes("admin")) return "/painel";
  if (roles.includes("secretaria") || roles.includes("mecanico")) return "/equipe";
  return "/painel";
}
