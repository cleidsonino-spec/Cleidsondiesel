import { describe, expect, it } from "vitest";
import { authorize, getPermissions, hasPermission, isUserRole } from "./authorization";

describe("role authorization policy", () => {
  it("grants the administrator all permissions", () => {
    expect(hasPermission("admin", "users.manage")).toBe(true);
    expect(hasPermission("admin", "payments.delete")).toBe(true);
    expect(hasPermission("admin", "settings.manage")).toBe(true);
  });

  it("limits employees to workshop operations", () => {
    expect(hasPermission("employee", "orders.diagnosis.update")).toBe(true);
    expect(hasPermission("employee", "orders.complete")).toBe(true);
    expect(hasPermission("employee", "orders.values.read")).toBe(false);
    expect(hasPermission("employee", "payments.read")).toBe(false);
    expect(hasPermission("employee", "users.manage")).toBe(false);
  });

  it("allows the secretary to view amounts and payments without changing them", () => {
    expect(hasPermission("secretary", "orders.values.read")).toBe(true);
    expect(hasPermission("secretary", "payments.read")).toBe(true);
    expect(hasPermission("secretary", "appointments.write")).toBe(true);
    expect(hasPermission("secretary", "payments.create")).toBe(false);
    expect(hasPermission("secretary", "payments.update")).toBe(false);
    expect(hasPermission("secretary", "payments.reverse")).toBe(false);
    expect(hasPermission("secretary", "payments.delete")).toBe(false);
    expect(hasPermission("secretary", "orders.diagnosis.update")).toBe(false);
  });

  it("denies inactive or missing users by default", () => {
    expect(authorize(null, "orders.read")).toBe(false);
    expect(authorize({ role: "admin", active: false }, "orders.read")).toBe(false);
    expect(authorize({ role: "secretary", active: true }, "payments.read")).toBe(true);
  });

  it("recognizes only the three supported roles", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("employee")).toBe(true);
    expect(isUserRole("secretary")).toBe(true);
    expect(isUserRole("owner")).toBe(false);
    expect(isUserRole(null)).toBe(false);
    expect(getPermissions("secretary")).toContain("payments.read");
  });
});
