import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { brokeredPreviewStorage } from "./previewAuthStorage";
import { supabaseAuthStorage } from "./authStorage";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("./previewAuthStorage", () => ({
  brokeredPreviewStorage: vi.fn(),
}));

const nativePlatform = vi.mocked(Capacitor.isNativePlatform);
const preferenceGet = vi.mocked(Preferences.get);
const preferenceSet = vi.mocked(Preferences.set);
const preferenceRemove = vi.mocked(Preferences.remove);
const previewStorage = vi.mocked(brokeredPreviewStorage);

describe("supabaseAuthStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    nativePlatform.mockReturnValue(true);
    preferenceGet.mockResolvedValue({ value: null });
    preferenceSet.mockResolvedValue();
    preferenceRemove.mockResolvedValue();
  });

  it("uses the preview broker on non-native platforms", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    nativePlatform.mockReturnValue(false);
    previewStorage.mockReturnValue(storage);

    expect(supabaseAuthStorage()).toBe(storage);
    expect(previewStorage).toHaveBeenCalledOnce();
    expect(preferenceGet).not.toHaveBeenCalled();
  });

  it("prefers the native Preferences session when one exists", async () => {
    preferenceGet.mockResolvedValue({ value: "native-session" });

    const value = await supabaseAuthStorage()?.getItem("auth-token");

    expect(value).toBe("native-session");
    expect(preferenceGet).toHaveBeenCalledWith({ key: "auth-token" });
    expect(window.localStorage.getItem("auth-token")).toBeNull();
    expect(preferenceSet).not.toHaveBeenCalled();
  });

  it("migrates a legacy localStorage session when Preferences is empty", async () => {
    window.localStorage.setItem("auth-token", "legacy-session");

    const value = await supabaseAuthStorage()?.getItem("auth-token");

    expect(value).toBe("legacy-session");
    expect(preferenceSet).toHaveBeenCalledWith({
      key: "auth-token",
      value: "legacy-session",
    });
  });

  it("returns null when Preferences and legacy localStorage are empty", async () => {
    const value = await supabaseAuthStorage()?.getItem("auth-token");

    expect(value).toBeNull();
  });

  it("does not fail if legacy localStorage cannot be read", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    const value = await supabaseAuthStorage()?.getItem("auth-token");

    expect(value).toBeNull();
  });

  it("writes native sessions only to Preferences", async () => {
    await supabaseAuthStorage()?.setItem("auth-token", "new-session");

    expect(preferenceSet).toHaveBeenCalledWith({
      key: "auth-token",
      value: "new-session",
    });
    expect(window.localStorage.getItem("auth-token")).toBeNull();
  });

  it("removes the native session and its legacy localStorage copy", async () => {
    window.localStorage.setItem("auth-token", "legacy-session");

    await supabaseAuthStorage()?.removeItem("auth-token");

    expect(preferenceRemove).toHaveBeenCalledWith({ key: "auth-token" });
    expect(window.localStorage.getItem("auth-token")).toBeNull();
  });

  it("does not fail if legacy localStorage cannot be cleared", async () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    await expect(supabaseAuthStorage()?.removeItem("auth-token")).resolves.toBeUndefined();
    expect(preferenceRemove).toHaveBeenCalledWith({ key: "auth-token" });
  });
});
