import type { Database } from "@/integrations/supabase/types";
import { readPartItems } from "./parts";
import { formatBRL, orderTotal } from "./status";
import { formatPlate } from "./plate";
import { formatDateBR } from "./schedule";
import logoAsset from "@/assets/logo-cleidson-diesel.png.asset.json";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];

export function quoteRows(o: Pick<Order, "part_items" | "parts_value" | "labor_value">) {
  const items = readPartItems(o.part_items);
  const rows = items.length ? items : Number(o.parts_value) ? [{ description: "Peças", quantity: 1, unit_value: Number(o.parts_value), value: Number(o.parts_value) }] : [];
  return [...rows, { description: "Mão de obra", quantity: 1, unit_value: Number(o.labor_value) || 0, value: Number(o.labor_value) || 0 }];
}

/** Runs only after hydration. PDFs stay private on the owner's device. */
export async function createQuotePdf(o: Order): Promise<File> {
  const { jsPDF } = await import("jspdf");
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Não foi possível carregar a logo."));
    image.src = logoAsset.url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 600; canvas.height = Math.round(600 * image.naturalHeight / image.naturalWidth);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a logo.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const logo = canvas.toDataURL("image/png");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 0.07;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const watermark = canvas.toDataURL("image/png");
  const ratio = canvas.height / canvas.width;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 16, right = 194;
  let y = 20;
  const text = (s: string, x: number, top: number, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(s, x, top);
  };
  const line = (top: number) => { pdf.setDrawColor(90); pdf.line(left, top, right, top); };
  function header(continued = false) {
    const markWidth = Math.min(130, 130 / ratio);
    pdf.addImage(watermark, "PNG", (210 - markWidth) / 2, (297 - markWidth * ratio) / 2, markWidth, markWidth * ratio, "watermark", "FAST");
    pdf.setDrawColor(150); pdf.setLineWidth(0.4);
    pdf.roundedRect(10, 10, 190, 277, 4, 4);
    const logoWidth = Math.min(30, 30 / ratio);
    pdf.addImage(logo, "PNG", left, 15, logoWidth, logoWidth * ratio, "shop-logo", "FAST");
    text("CLEIDSON DIESEL", 52, 23, 18, true);
    text("Bomba injetora e injeção diesel", 52, 30, 10);
    text("WhatsApp: (71) 98657-1661", 52, 37, 10);
    text("Segunda a sexta • 08h às 17h", 52, 43, 9);
    line(48);
    text(continued ? "ORÇAMENTO — CONTINUAÇÃO" : "ORÇAMENTO", left, 59, 18, true);
    text(`OS nº ${o.number}`, 158, 59, 11, true);
    line(64); y = 72;
  }
  function room(height: number) {
    if (y + height > 270) { pdf.addPage(); header(true); }
  }
  function field(label: string, value: string) {
    const lines = pdf.splitTextToSize(value || "—", 175) as string[];
    room(9); text(label, left, y, 9, true); y += 5;
    for (const s of lines) { room(6); text(s, left, y, 10); y += 5; }
    y += 3;
  }
  header();
  field("CLIENTE", o.customer_name);
  field("TELEFONE", o.phone || "—");
  field("VEÍCULO / PLACA", `${o.vehicle}${o.vehicle_year ? ` • ${o.vehicle_year}` : ""} / ${formatPlate(o.plate)}`);
  field("ENTRADA / PREVISÃO DE ENTREGA", `${formatDateBR(o.entry_date)} / ${o.due_date ? formatDateBR(o.due_date) : "A combinar"}`);
  field("SERVIÇO SOLICITADO", o.complaint);
  if (o.diagnosis) field("DIAGNÓSTICO", o.diagnosis);
  if (o.parts) field("PEÇAS E SERVIÇOS", o.parts);
  function tableHeader() {
    room(12); pdf.setFillColor(32, 32, 32); pdf.rect(left, y, 178, 9, "F"); pdf.setTextColor(255);
    text("ITEM", 18, y + 6, 7, true); text("DISCRIMINAÇÃO", 31, y + 6, 7, true);
    text("QTD", 128, y + 6, 7, true); text("UNIT. (R$)", 141, y + 6, 7, true);
    text("TOTAL (R$)", 169, y + 6, 7, true); pdf.setTextColor(32); y += 9;
  }
  tableHeader();
  quoteRows(o).forEach((item, index) => {
    const lines = pdf.splitTextToSize(item.description, 92) as string[];
    const height = Math.max(10, lines.length * 5 + 5);
    if (y + height > 264) { pdf.addPage(); header(true); tableHeader(); }
    text(String(index + 1).padStart(2, "0"), 18, y + 6, 8);
    text(String(item.quantity), 129, y + 6, 8);
    text(formatBRL(item.unit_value), 141, y + 6, 8);
    text(formatBRL(item.value), 169, y + 6, 8);
    for (const s of lines) {
      if (y + 8 > 264) { line(y); pdf.addPage(); header(true); tableHeader(); }
      text(s, 31, y + 6, 8); y += 5;
    }
    y += 5; line(y);
  });
  y += 8; room(35);
  text(`Peças: ${formatBRL(Number(o.parts_value))}`, left, y, 10); y += 7;
  text(`Mão de obra: ${formatBRL(Number(o.labor_value))}`, left, y, 10); y += 9;
  text(`TOTAL: ${formatBRL(orderTotal(o.parts_value, o.labor_value))}`, left, y, 15, true); y += 12;
  room(16); line(y); text("Autorização do cliente: _____________________________________", left, y + 8, 10);
  const count = pdf.getNumberOfPages();
  for (let page = 1; page <= count; page++) { pdf.setPage(page); text(`Cleidson Diesel • Orçamento • ${page}/${count}`, left, 281, 8); }
  pdf.setProperties({ title: `Orçamento OS ${o.number} — Cleidson Diesel`, author: "Cleidson Diesel" });
  return new File([pdf.output("blob")], `orcamento-cleidson-diesel-OS-${o.number}.pdf`, { type: "application/pdf" });
}

export function downloadQuote(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a"); a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}