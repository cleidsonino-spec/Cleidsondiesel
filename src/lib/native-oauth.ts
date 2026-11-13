import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import { supabase } from "@/integrations/supabase/client";

const CALLBACK_HOST = "cleidsondiesel.lovable.app";
const CALLBACK_PATH = "/auth";
const LEGACY_CALLBACK_PROTOCOL = "br.com.cleidsondiesel.painel:";
const STATE_STORAGE_KEY = "cleidson-diesel-native-oauth-state";

async function completeNativeOAuth(rawUrl: string) {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(rawUrl);
  } catch {
    return false;
  }

  const isVerifiedHttpsCallback =
    callbackUrl.protocol === "https:" &&
    callbackUrl.hostname === CALLBACK_HOST &&
    callbackUrl.pathname === CALLBACK_PATH;
  const isLegacyCustomCallback =
    callbackUrl.protocol === LEGACY_CALLBACK_PROTOCOL &&
    callbackUrl.hostname === "auth" &&
    callbackUrl.pathname === "/callback";

  if (!isVerifiedHttpsCallback && !isLegacyCustomCallback) return false;

  // Both callback formats return the session in the URL fragment; query is
  // also supported for compatibility with broker response variants.
  const fragment = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
  const query = callbackUrl.searchParams;
  const read = (key: string) => fragment.get(key) ?? query.get(key);

  // The HTTPS broker flow uses our own state value. The legacy URI flow uses
  // the OAuth SDK's state validation, as in the previously working APK.
  if (isVerifiedHttpsCallback) {
    const returnedState = read("state");
    const expectedState = localStorage.getItem(STATE_STORAGE_KEY);
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      console.warn("[Auth] Retorno OAuth HTTPS ignorado: estado inválido ou expirado.");
      return false;
    }
  }

  const access_token = read("access_token");
  const refresh_token = read("refresh_token");
  if (!access_token || !refresh_token) {
    console.error("[Auth] O retorno OAuth não contém a sessão esperada.");
    return false;
  }

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error || !data.session) {
    console.error("[Auth] Não foi possível restaurar a sessão OAuth.", error);
    return false;
  }

  localStorage.removeItem(STATE_STORAGE_KEY);
  await Browser.close().catch(() => undefined);

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.session.user.id)
    .maybeSingle();

  window.location.assign(
    roleData?.role === "secretaria" || roleData?.role === "mecanico" ? "/equipe" : "/painel",
  );
  return true;
}

/** Registers both the legacy custom-scheme callback and the HTTPS App Link. */
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

  const launch = await App.getLaunchUrl();
  if (launch?.url) await handleUrl(launch.url);

  return () => {
    active = false;
    void listener.remove();
  };
}
