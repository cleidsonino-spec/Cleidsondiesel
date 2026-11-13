import type { Database } from "@/integrations/supabase/types";
import { readPartItems } from "./parts";
import { formatBRL, orderDiscountAmount, orderTotal } from "./status";
import { formatPlate } from "./plate";
import { formatDateBR } from "./schedule";
import logoAsset from "@/assets/logo-cleidson-diesel.png.asset.json";

type Order = Database["public"]["Tables"]["service_orders"]["Row"];

export type QuotePdfOptions = {
  validityDays: number;
  paymentTerms: string;
  paymentMethods: string;
  serviceConditions: string;
  observations: string;
};

export const defaultQuotePdfOptions: QuotePdfOptions = {
  validityDays: 7,
  paymentTerms: "",
  paymentMethods: "",
  serviceConditions: "",
  observations: "",
};

export function quoteRows(o: Pick<Order, "part_items" | "parts_value" | "labor_value">) {
  const items = readPartItems(o.part_items);
  const rows = items.length ? items : Number(o.parts_value) ? [{ description: "Peças", quantity: 1, unit_value: Number(o.parts_value), value: Number(o.parts_value) }] : [];
  return [...rows, { description: "Mão de obra", quantity: 1, unit_value: Number(o.labor_value) || 0, value: Number(o.labor_value) || 0 }];
}

function datePlusDays(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toLocaleDateString("pt-BR");
}

/** Generates a private quote PDF on the owner's device. */
export async function createQuotePdf(o: Order, preparedBy = "", options: QuotePdfOptions = defaultQuotePdfOptions): Promise<File> {
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
  ctx.globalAlpha = 0.055;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const watermark = canvas.toDataURL("image/png");
  const ratio = canvas.height / canvas.width;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 16, right = 194, contentWidth = 178;
  let y = 20;
  const text = (s: string, x: number, top: number, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(s, x, top);
  };
  const line = (top: number) => { pdf.setDrawColor(205); pdf.setLineWidth(0.25); pdf.line(left, top, right, top); };
  function header(continued = false) {
    const markWidth = Math.min(118, 118 / ratio);
    pdf.addImage(watermark, "PNG", (210 - markWidth) / 2, (297 - markWidth * ratio) / 2, markWidth, markWidth * ratio, "watermark", "FAST");
    pdf.setDrawColor(220); pdf.setLineWidth(0.35);
    pdf.roundedRect(10, 10, 190, 277, 3, 3, "S");
    const logoWidth = Math.min(29, 29 / ratio);
    pdf.addImage(logo, "PNG", left, 14, logoWidth, logoWidth * ratio, "shop-logo", "FAST");
    pdf.setTextColor(25, 35, 45);
    text("CLEIDSON DIESEL", 52, 22, 18, true);
    text("Bomba injetora e injeção diesel", 52, 29, 9);
    text("WhatsApp: (71) 98657-1661", 52, 35, 9);
    text("Segunda a sexta • 08h às 17h", 52, 41, 8);
    pdf.setFillColor(25, 35, 45); pdf.roundedRect(left, 49, contentWidth, 16, 2, 2, "F");
    pdf.setTextColor(255, 255, 255);
    text(continued ? "ORÇAMENTO • CONTINUAÇÃO" : "ORÇAMENTO", 21, 59, 15, true);
    text(`OS nº ${o.number}`, 169, 59, 10, true);
    pdf.setTextColor(30, 30, 30);
    y = 74;
  }
  function room(height: number) {
    if (y + height > 270) { pdf.addPage(); header(true); }
  }
  function section(title: string, value: string) {
    if (!value.trim()) return;
    const lines = pdf.splitTextToSize(value.trim(), contentWidth - 8) as string[];
    room(13 + lines.length * 4.8);
    pdf.setFillColor(245, 247, 249);
    pdf.roundedRect(left, y, contentWidth, 8, 1.5, 1.5, "F");
    pdf.setTextColor(35, 45, 55);
    text(title.toUpperCase(), left + 3, y + 5.5, 8, true);
    y += 13;
    pdf.setTextColor(55, 55, 55);
    for (const s of lines) { room(6); text(s, left + 2, y, 9); y += 4.8; }
    y += 3;
  }
  header();
  const validDays = Number.isFinite(options.validityDays) ? Math.min(90, Math.max(1, Math.round(options.validityDays))) : 7;
  pdf.setFillColor(238, 243, 247); pdf.roundedRect(left, y, contentWidth, 12, 2, 2, "F");
  pdf.setTextColor(35, 45, 55);
  text(`EMITIDO EM: ${new Date().toLocaleDateString("pt-BR")}`, left + 4, y + 5, 8, true);
  text(`VÁLIDO ATÉ: ${datePlusDays(validDays)}`, 111, y + 5, 8, true);
  text(`Validade: ${validDays} dias`, left + 4, y + 10, 7);
  y += 18;
  section("Dados do cliente", `${o.customer_name}\nTelefone: ${o.phone || "—"}`);
  section("Veículo / equipamento", `${o.vehicle}${o.vehicle_year ? ` • ${o.vehicle_year}` : ""} • Placa: ${formatPlate(o.plate)}\nQuilometragem: ${o.mileage || "—"}`);
  section("Prazos", `Entrada: ${formatDateBR(o.entry_date)} • Previsão de entrega: ${o.due_date ? formatDateBR(o.due_date) : "A combinar"}`);
  section("Serviço solicitado", o.complaint);
  if (preparedBy.trim()) section("Responsável pelo orçamento", preparedBy.trim());
  section("Diagnóstico técnico", o.diagnosis || "");
  section("Peças e serviços", o.parts || "");

  function tableHeader() {
    room(12);
    pdf.setFillColor(35, 45, 55); pdf.rect(left, y, contentWidth, 9, "F"); pdf.setTextColor(255);
    text("ITEM", 19, y + 6, 7, true); text("DESCRIÇÃO", 34, y + 6, 7, true);
    text("QTD.", 127, y + 6, 7, true); text("UNITÁRIO", 143, y + 6, 7, true);
    text("TOTAL", 174, y + 6, 7, true); pdf.setTextColor(35); y += 9;
  }
  tableHeader();
  quoteRows(o).forEach((item, index) => {
    const lines = pdf.splitTextToSize(item.description, 88) as string[];
    const height = Math.max(10, lines.length * 4.5 + 5);
    if (y + height > 264) { pdf.addPage(); header(true); tableHeader(); }
    text(String(index + 1).padStart(2, "0"), 19, y + 6, 8);
    text(String(item.quantity), 128, y + 6, 8);
    text(formatBRL(item.unit_value), 143, y + 6, 8);
    text(formatBRL(item.value), 174, y + 6, 8);
    for (const s of lines) { text(s, 34, y + 6, 8); y += 4.5; }
    y += 5; line(y);
  });
  const hasDiscount = Number(o.discount_percent ?? 0) > 0;
  const summaryHeight = hasDiscount ? 36 : 29;
  room(summaryHeight + 12);
  y += 5;
  pdf.setFillColor(245, 247, 249); pdf.roundedRect(111, y, 83, summaryHeight, 2, 2, "F");
  pdf.setTextColor(65, 65, 65);
  text(`Peças: ${formatBRL(Number(o.parts_value))}`, 116, y + 7, 8);
  text(`Mão de obra: ${formatBRL(Number(o.labor_value))}`, 116, y + 14, 8);
  if (hasDiscount) text(`Desconto (${Number(o.discount_percent)}%): -${formatBRL(orderDiscountAmount(o.parts_value, o.labor_value, o.discount_percent))}`, 116, y + 21, 8);
  const totalY = hasDiscount ? y + 32 : y + 25;
  pdf.setFillColor(25, 35, 45); pdf.roundedRect(111, totalY - 7, 83, 11, 1.5, 1.5, "F");
  pdf.setTextColor(255, 255, 255);
  text("TOTAL DO ORÇAMENTO", 115, totalY, 7, true);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
  pdf.text(formatBRL(orderTotal(o.parts_value, o.labor_value, o.discount_percent)), 190, totalY, { align: "right" });
  pdf.setTextColor(35); y += summaryHeight + 7;

  section("Condições de pagamento", options.paymentTerms);
  section("Formas de pagamento", options.paymentMethods);
  section("Condições do serviço", options.serviceConditions);
  section("Observações", options.observations);

  room(34);
  y += 9;
  line(y);
  text("AUTORIZAÇÃO E ASSINATURAS", left, y + 7, 8, true);
  y += 24;
  pdf.setDrawColor(80);
  pdf.line(left + 2, y, left + 82, y);
  pdf.line(left + 96, y, right - 2, y);
  text("CLIENTE", left + 26, y + 5, 8, true);
  text("RESPONSÁVEL • CLEIDSON DIESEL", left + 103, y + 5, 8, true);
  text("Assinatura e data", left + 26, y + 10, 7);
  text("Assinatura e data", left + 119, y + 10, 7);

  const count = pdf.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(220); pdf.line(left, 276, right, 276);
    pdf.setTextColor(110);
    text(`Cleidson Diesel • Orçamento • ${page}/${count}`, left, 282, 7);
  }
  pdf.setProperties({ title: `Orçamento OS ${o.number} — Cleidson Diesel`, author: "Cleidson Diesel" });
  return new File([pdf.output("blob")], `orcamento-cleidson-diesel-OS-${o.number}.pdf`, { type: "application/pdf" });
}

export function downloadQuote(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a"); a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
