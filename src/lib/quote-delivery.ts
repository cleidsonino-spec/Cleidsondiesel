import { Capacitor, registerPlugin } from "@capacitor/core";
import { downloadQuote } from "./quote-pdf";

const filesystem = registerPlugin<{
  writeFile(options: { path: string; data: string; directory: "CACHE" | "DOCUMENTS"; recursive: boolean }): Promise<{ uri: string }>;
}>("Filesystem");
const share = registerPlugin<{
  share(options: { title: string; text: string; files: string[]; dialogTitle: string }): Promise<void>;
}>("Share");

function nativeFilesAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Filesystem");
}

async function saveNative(file: File, directory: "CACHE" | "DOCUMENTS") {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return filesystem.writeFile({ path: file.name, data: btoa(binary), directory, recursive: true });
}

export async function saveQuote(file: File): Promise<void> {
  if (nativeFilesAvailable()) {
    await saveNative(file, "DOCUMENTS");
    return;
  }
  downloadQuote(file);
}

export function canShareQuote(file: File): boolean {
  if (nativeFilesAvailable() && Capacitor.isPluginAvailable("Share")) return true;
  try {
    return typeof navigator.share === "function" && Boolean(navigator.canShare?.({ files: [file] }));
  } catch { return false; }
}

export async function shareQuote(file: File, title: string, text: string): Promise<void> {
  if (nativeFilesAvailable() && Capacitor.isPluginAvailable("Share")) {
    const saved = await saveNative(file, "CACHE");
    await share.share({ title, text, files: [saved.uri], dialogTitle: "Compartilhar orçamento" });
    return;
  }
  // O PDF já está preparado: mantém a ativação do clique para Safari/iOS.
  await navigator.share({ files: [file], title, text });
}