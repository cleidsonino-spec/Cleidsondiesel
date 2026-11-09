import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.cleidsondiesel.painel",
  appName: "Cleidson Diesel",
  webDir: "public",
  server: {
    // The APK opens the existing hosted panel in its own Android window.
    // Authentication and data continue to use the existing backend.
    url: "https://cleidsondiesel.lovable.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
