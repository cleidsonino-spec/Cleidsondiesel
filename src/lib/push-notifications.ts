import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

const PUSH_WORKER_URL = "https://cleidson-diesel-push.cleidsonino.workers.dev";
let currentFcmToken: string | null = null;

async function sendTokenToWorker(path: "register" | "unregister", token: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("AUTH_REQUIRED");

  const response = await fetch(`${PUSH_WORKER_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "",
    },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(typeof result.error === "string" ? result.error : "PUSH_REGISTRATION_FAILED");
  }
}

export async function startStaffPushNotifications() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return () => {};

  let active = true;
  const listeners: PluginListenerHandle[] = [];

  const registration = await PushNotifications.addListener("registration", async ({ value }) => {
    if (!active) return;
    currentFcmToken = value;
    try {
      await sendTokenToWorker("register", value);
    } catch {
      console.error("[Push] Não foi possível registrar este aparelho.");
    }
  });
  listeners.push(registration);

  const action = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const route = notification.data?.route;
    if (typeof route === "string" && (route.startsWith("/painel") || route.startsWith("/equipe"))) {
      window.location.assign(route);
    }
  });
  listeners.push(action);

  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive === "granted") await PushNotifications.register();
  } catch {
    console.error("[Push] Não foi possível ativar notificações neste aparelho.");
  }

  return () => {
    active = false;
    for (const listener of listeners) void listener.remove();
  };
}

export async function unregisterAdminPushDevice() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  const token = currentFcmToken;
  if (!token) return;
  try {
    await sendTokenToWorker("unregister", token);
    currentFcmToken = null;
  } catch {
    console.error("[Push] Não foi possível remover este aparelho.");
  }
}
