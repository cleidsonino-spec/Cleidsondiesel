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
  plate: string;
  mileage: string | null;
  entry_date: string;
};

export async function createInspectionReportPdf(
  order: InspectionReportOrder,
  report: InspectionReportData,
): Promise<File> {
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
    pdf.text("Bomba injetora e injeção diesel", left, 30);
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
    ["Placa", formatPlate(order.plate)],
    ["Quilometragem", order.mileage || "—"],
    ["Entrada na oficina", formatDateBR(order.entry_date)],
  ];
  pdf.setDrawColor(210);
  pdf.roundedRect(left, y, width, 34, 2, 2, "S");
  let detailY = y + 7;
  details.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(`${label}:`, left + 4 + col * 88, y + 7 + row * 10);
    pdf.setFont("helvetica", "normal");
    pdf.text(pdf.splitTextToSize(value, 78)[0] || "—", left + 4 + col * 88, y + 11 + row * 10);
    detailY = Math.max(detailY, y + 11 + row * 10);
  });
  y = detailY + 8;

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
  anchor.click();
  URL.revokeObjectURL(url);
}
