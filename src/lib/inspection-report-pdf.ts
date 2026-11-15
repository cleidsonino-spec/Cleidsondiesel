import { Capacitor, registerPlugin } from "@capacitor/core";
import { formatPlate } from "@/lib/plate";
import { formatDateBR } from "@/lib/schedule";

export type InspectionReportData = {
  diagnosis: string;
  executed_parts: string;
  rejected_items: string;
  inspection_observations: string;
};
export type InspectionReportOrder = {
  number: number;
  customer_name: string;
  phone: string | null;
  vehicle: string;
  vehicle_year: string | null;
  plate: string | null;
  mileage: string | null;
  entry_date: string;
};

export async function createInspectionReportPdf(order: InspectionReportOrder, report: InspectionReportData): Promise<File> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 17;
  const right = 193;
  const width = right - left;
  let y = 20;

  const addHeader = (continued = false) => {
    pdf.setFillColor(25, 35, 45);
    pdf.roundedRect(10, 10, 190, 34, 2, 2, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text("CLEIDSON DIESEL", left, 23);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("RELATÓRIO EMITIDO PELA CLEIDSON DIESEL", left, 30);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(continued ? "RELATÓRIO TÉCNICO • CONTINUAÇÃO" : "RELATÓRIO TÉCNICO DE INSPEÇÃO", left, 39);
    pdf.setTextColor(30, 30, 30);
    y = 53;
  };
  const ensureRoom = (height: number) => {
    if (y + height > 278) {
      pdf.addPage();
      addHeader(true);
    }
  };
  const paragraph = (label: string, value: string) => {
    if (!value.trim()) return;
    const lines = pdf.splitTextToSize(value.trim(), width - 8) as string[];
    ensureRoom(15);
    pdf.setFillColor(241, 244, 247);
    pdf.roundedRect(left, y, width, 8, 1, 1, "F");
    pdf.setTextColor(35, 45, 55);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(label.toUpperCase(), left + 3, y + 5.5);
    y += 13;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(45, 45, 45);
    for (const line of lines) {
      ensureRoom(7);
      pdf.text(line, left + 2, y);
      y += 5;
    }
    y += 5;
  };

  addHeader();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(`OS nº ${order.number}`, left, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 145, y);
  y += 9;

  const details = [
    ["Cliente", order.customer_name],
    ["Telefone", order.phone || "—"],
    ["Veículo/equipamento", [order.vehicle, order.vehicle_year].filter(Boolean).join(" • ") || "—"],
    ["Placa", formatPlate(order.plate) || "Não se aplica"],
    ["Quilometragem", order.mileage || "—"],
    ["Entrada na oficina", formatDateBR(order.entry_date)],
  ];
  pdf.setDrawColor(210);
  pdf.roundedRect(left, y, width, 34, 2, 2, "S");
  details.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(`${label}:`, left + 4 + col * 88, y + 7 + row * 10);
    pdf.setFont("helvetica", "normal");
    pdf.text(pdf.splitTextToSize(value ?? "", 78)[0] || "—", left + 4 + col * 88, y + 11 + row * 10);
  });
  y += 42;
  paragraph("Diagnóstico", report.diagnosis);
  paragraph("Peças e serviços executados", report.executed_parts);
  paragraph("Itens reprovados", report.rejected_items);
  paragraph("Observações da inspeção", report.inspection_observations);
  if (![report.diagnosis, report.executed_parts, report.rejected_items, report.inspection_observations].some((v) => v.trim())) {
    paragraph("Inspeção", "Nenhuma informação foi registrada neste relatório.");
  }
  ensureRoom(24);
  pdf.setDrawColor(100);
  pdf.line(left + 5, y + 15, left + 78, y + 15);
  pdf.line(left + 100, y + 15, right - 5, y + 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Responsável técnico", left + 20, y + 20);
  pdf.text("Cleidson Diesel", left + 125, y + 20);
  const blob = pdf.output("blob");
  return new File([blob], `relatorio-inspecao-OS-${order.number}.pdf`, { type: "application/pdf" });
}

export function downloadInspectionReport(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Android/Chrome pode iniciar o download de forma assíncrona.
  // Revogar a URL imediatamente interrompe o acesso ao Blob antes
  // de o navegador concluir a leitura do arquivo.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}


type NativeFilesystem = {
  writeFile(options: { path: string; data: string; directory: "CACHE" | "DATA"; encoding?: "utf8"; recursive?: boolean }): Promise<{ uri: string }>;
  readFile(options: { path: string; directory: "CACHE" | "DATA" }): Promise<{ data: string }>;
  stat(options: { path: string; directory: "CACHE" | "DATA" }): Promise<{ size: number; type: string }>;
};
type NativeShare = {
  share(options: { title?: string; text?: string; files?: string[]; dialogTitle?: string }): Promise<void>;
};
const NativeFilesystem = registerPlugin<NativeFilesystem>("Filesystem");
const NativeShare = registerPlugin<NativeShare>("Share");

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function saveInspectionReport(file: File): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    await NativeFilesystem.writeFile({
      path: file.name,
      data: await fileToBase64(file),
      directory: "DATA",
      recursive: true,
    });
    await validateSavedPdf(file, "DATA");
    return;
  }
  downloadInspectionReport(file);
}

async function validateSavedPdf(file: File, directory: "CACHE" | "DATA"): Promise<void> {
  const [metadata, saved] = await Promise.all([
    NativeFilesystem.stat({ path: file.name, directory }),
    NativeFilesystem.readFile({ path: file.name, directory }),
  ]);

  // O tamanho retornado por stat pode variar entre versões/implementações
  // do provider Android. A confirmação principal é comparar os bytes lidos
  // do arquivo com os bytes originais que foram enviados para writeFile.
  const expected = new Uint8Array(await file.arrayBuffer());
  let binary: string;
  try {
    binary = atob(saved.data.replace(/\s/g, ""));
  } catch {
    throw new Error(
      `Não foi possível decodificar o PDF salvo (esperado: ${expected.length} bytes; stat: ${metadata.size} bytes; tipo: ${metadata.type}). Gere o relatório novamente.`,
    );
  }

  const actual = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) actual[i] = binary.charCodeAt(i);

  let firstDifference = -1;
  const compareLength = Math.min(expected.length, actual.length);
  for (let i = 0; i < compareLength; i += 1) {
    if (expected[i] !== actual[i]) {
      firstDifference = i;
      break;
    }
  }

  if (
    metadata.type !== "file" ||
    actual.length !== expected.length ||
    firstDifference !== -1
  ) {
    throw new Error(
      `O PDF salvo diverge do original (original: ${expected.length} bytes; leitura: ${actual.length} bytes; stat: ${metadata.size} bytes; tipo: ${metadata.type}; primeira diferença: ${firstDifference === -1 ? "nenhuma" : firstDifference}). Gere o relatório novamente.`,
    );
  }

  const header = String.fromCharCode(...actual.subarray(0, 5));
  const tail = String.fromCharCode(...actual.subarray(Math.max(0, actual.length - 1024)));
  if (header !== "%PDF-" || !tail.includes("%%EOF")) {
    throw new Error(
      `O arquivo salvo não contém a estrutura completa de PDF (tamanho confirmado: ${actual.length} bytes). Gere o relatório novamente.`,
    );
  }
}

export async function shareInspectionReport(file: File, title: string, text: string): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const saved = await NativeFilesystem.writeFile({
      path: file.name,
      data: await fileToBase64(file),
      directory: "DATA",
      recursive: true,
    });
    await validateSavedPdf(file, "DATA");
    // Envie somente o anexo. Misturar EXTRA_TEXT e EXTRA_STREAM pode fazer
    // alguns destinos tratarem o compartilhamento como texto, não documento.
    await NativeShare.share({ title, files: [saved.uri], dialogTitle: "Compartilhar relatório técnico" });
    return;
  }
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text });
    return;
  }
  downloadInspectionReport(file);
}
