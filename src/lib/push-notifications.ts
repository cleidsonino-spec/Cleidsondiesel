import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

export async function startAdminPushNotifications() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return () => {};

  let active = true;
  const listeners: PluginListenerHandle[] = [];

  const registration = await PushNotifications.addListener("registration", async ({ value }) => {
    if (!active) return;
    const { error } = await supabase.functions.invoke("register-device", { body: { token: value } });
    if (error) console.error("[Push] Não foi possível registrar este aparelho.");
  });
  listeners.push(registration);

  const action = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const route = notification.data?.route;
    if (typeof route === "string" && route.startsWith("/painel")) {
      window.location.assign(route);
    }
  });
  listeners.push(action);

  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt") permission = await PushNotifications.requestPermissions();
    if (permission.receive === "granted") {
      await PushNotifications.register();
    }
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
  await supabase.functions.invoke("unregister-device", { body: {} });
}
