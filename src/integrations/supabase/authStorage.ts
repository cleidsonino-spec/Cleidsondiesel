import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

import { brokeredPreviewStorage } from "./previewAuthStorage";

/**
 * Supabase auth storage for native apps.
 *
 * Android may clear WebView localStorage, so native sessions live in the
 * operating system's persistent Preferences store. Existing localStorage
 * sessions are migrated on first read to avoid forcing a fresh login.
 */
export function supabaseAuthStorage() {
  if (!Capacitor.isNativePlatform()) {
    return brokeredPreviewStorage();
  }

  return {
    getItem: async (key: string): Promise<string | null> => {
      const stored = await Preferences.get({ key });
      if (stored.value !== null) return stored.value;

      // One-time migration from sessions created by earlier app versions.
      try {
        const legacyValue = window.localStorage.getItem(key);
        if (legacyValue !== null) {
          await Preferences.set({ key, value: legacyValue });
          return legacyValue;
        }
      } catch {
        // Native Preferences remains the authoritative storage.
      }

      return null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      await Preferences.set({ key, value });
    },
    removeItem: async (key: string): Promise<void> => {
      await Preferences.remove({ key });
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore unavailable legacy WebView storage.
      }
    },
  };
}
