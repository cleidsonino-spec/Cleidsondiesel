/**
 * Central permission policy for the independent Cleidson Diesel application.
 *
 * This module is intentionally independent of the current Supabase session.
 * Do not use a role supplied by the browser as an authorization source.
 * Call these helpers only after resolving an active user/session on the server.
 */

export type UserRole = "admin" | "employee" | "secretary";

export type Permission =
  | "users.manage"
  | "settings.manage"
  | "customers.read"
  | "customers.write"
  | "vehicles.read"
  | "vehicles.write"
  | "appointments.read"
  | "appointments.write"
  | "orders.read"
  | "orders.create"
  | "orders.update"
  | "orders.diagnosis.update"
  | "orders.complete"
  | "orders.values.read"
  | "payments.read"
  | "payments.create"
  | "payments.update"
  | "payments.reverse"
  | "payments.delete"
  | "warranties.read"
  | "warranties.manage";

const allPermissions: readonly Permission[] = [
  "users.manage",
  "settings.manage",
  "customers.read",
  "customers.write",
  "vehicles.read",
  "vehicles.write",
  "appointments.read",
  "appointments.write",
  "orders.read",
  "orders.create",
  "orders.update",
  "orders.diagnosis.update",
  "orders.complete",
  "orders.values.read",
  "payments.read",
  "payments.create",
  "payments.update",
  "payments.reverse",
  "payments.delete",
  "warranties.read",
  "warranties.manage",
];

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  admin: allPermissions,
  employee: [
    "customers.read",
    "vehicles.read",
    "appointments.read",
    "orders.read",
    "orders.create",
    "orders.update",
    "orders.diagnosis.update",
    "orders.complete",
    "warranties.read",
  ],
  secretary: [
    "customers.read",
    "customers.write",
    "vehicles.read",
    "vehicles.write",
    "appointments.read",
    "appointments.write",
    "orders.read",
    "orders.values.read",
    "payments.read",
    "warranties.read",
  ],
};

export function hasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole): readonly Permission[] {
  return rolePermissions[role] ?? [];
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "employee" || value === "secretary";
}

/**
 * Default-deny authorization helper for server handlers.
 * Inactive accounts are denied even if their role would otherwise allow access.
 */
export function authorize(
  user: { role: UserRole; active: boolean } | null | undefined,
  permission: Permission,
): boolean {
  if (!user?.active || !isUserRole(user.role)) return false;
  return hasPermission(user.role, permission);
}
