import { describe, expect, it } from "vitest";
import { getRoleHomePath } from "./auth-routing";

describe("getRoleHomePath", () => {
  it("sends administrators to the main panel", () => {
    expect(getRoleHomePath(["admin"])).toBe("/painel");
  });

  it("sends secretaries to the team workspace", () => {
    expect(getRoleHomePath(["secretaria"])).toBe("/equipe");
  });

  it("sends mechanics to the team workspace", () => {
    expect(getRoleHomePath(["mecanico"])).toBe("/equipe");
  });

  it("resolves multiple staff roles without relying on maybeSingle", () => {
    expect(getRoleHomePath(["secretaria", "mecanico"])).toBe("/equipe");
  });

  it("keeps administrator access as the highest priority", () => {
    expect(getRoleHomePath(["admin", "secretaria", "mecanico"])).toBe("/painel");
  });

  it("falls back to the main panel when no recognized role exists", () => {
    expect(getRoleHomePath([])).toBe("/painel");
    expect(getRoleHomePath(["unknown"])).toBe("/painel");
  });
});
