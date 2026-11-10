import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import { supabase } from "@/integrations/supabase/client";

const CALLBACK_HOST = "cleidsondiesel.lovable.app";
const CALLBACK_PATH = "/auth";
const STATE_STORAGE_KEY = "cleidson-diesel-native-oauth-state";

type OAuthProvider = "google" | "lovable";

function createState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Starts the same Lovable OAuth broker flow used by cloud-auth-js, but in the
 * system browser so Android can reopen this app through a verified HTTPS App Link.
 */
export async function startNativeOAuth(provider: OAuthProvider) {
  const state = createState();
  localStorage.setItem(STATE_STORAGE_KEY, state);

  const initiateUrl = new URL("/~oauth/initiate", window.location.origin);
  initiateUrl.search = new URLSearchParams({
    provider,
    redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
    state,
  }).toString();

  try {
    await Browser.open({ url: initiateUrl.toString(), presentationStyle: "fullscreen" });
  } catch (error) {
    localStorage.removeItem(STATE_STORAGE_KEY);
    throw error;
  }
}

async function completeNativeOAuth(rawUrl: string) {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(rawUrl);
  } catch {
    return false;
  }

  if (
    callbackUrl.protocol !== "https:" ||
    callbackUrl.hostname !== CALLBACK_HOST ||
    callbackUrl.pathname !== CALLBACK_PATH
  ) {
    return false;
  }

  // Lovable's broker returns the OAuth response in the URL fragment. Query
  // parameters are also read for compatibility with broker response variants.
  const fragment = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
  const query = callbackUrl.searchParams;
  const read = (key: string) => fragment.get(key) ?? query.get(key);

  const returnedState = read("state");
  const expectedState = localStorage.getItem(STATE_STORAGE_KEY);
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    console.warn("[Auth] Retorno OAuth ignorado: estado inválido ou expirado.");
    return false;
  }

  const access_token = read("access_token");
  const refresh_token = read("refresh_token");
  if (!access_token || !refresh_token) {
    console.error("[Auth] O retorno OAuth não contém a sessão esperada.");
    return false;
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    console.error("[Auth] Não foi possível restaurar a sessão OAuth.", error);
    return false;
  }

  localStorage.removeItem(STATE_STORAGE_KEY);
  await Browser.close().catch(() => undefined);
  window.location.assign("/painel");
  return true;
}

/** Registers the verified App Link callback, including cold app launches. */
export async function initializeNativeOAuthCallback() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return () => undefined;
  }

  let active = true;
  const handleUrl = async (url: string) => {
    if (!active) return;
    try {
      await completeNativeOAuth(url);
    } catch (error) {
      console.error("[Auth] Falha ao processar retorno do Google.", error);
    }
  };

  const listener = await App.addListener("appUrlOpen", ({ url }) => {
    void handleUrl(url);
  });

  // Register the listener first so a callback arriving during startup is not lost.
  const launch = await App.getLaunchUrl();
  if (launch?.url) await handleUrl(launch.url);

  return () => {
    active = false;
    void listener.remove();
  };
}
