import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-cleidson-diesel.png.asset.json";
import { warrantiesQuery, warrantyState } from "@/lib/warranty";
import { formatDateBR, todayISO } from "@/lib/schedule";
import { formatPlate } from "@/lib/plate";

export const Route = createFileRoute("/_authenticated/painel/garantias/$id")({
  head: () => ({
    meta: [
      { title: "Certificado de garantia — Cleidson Diesel" },
      { name: "description", content: "Certificado de garantia de peças e serviços da Cleidson Diesel." },
      { property: "og:title", content: "Certificado de garantia — Cleidson Diesel" },
      { property: "og:description", content: "Identificação, cobertura e prazo de garantia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(warrantiesQuery()),
  component: Certificate,
});

type Warranty = Awaited<ReturnType<NonNullable<ReturnType<typeof warrantiesQuery>["queryFn"]>>>[number];

async function downloadWarrantyPdf(w: Warranty) {
  const order = w.service_orders;
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const addHeader = async () => {
    pdf.setDrawColor(35, 75, 105);
    pdf.setLineWidth(0.8);
    pdf.line(margin, 48, pageWidth - margin, 48);
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Logo indisponível"));
        image.src = logo.url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = Math.round(240 * image.naturalHeight / image.naturalWidth);
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const imageWidth = 25;
        const imageHeight = imageWidth * canvas.height / canvas.width;
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, 16, imageWidth, imageHeight);
      }
    } catch {
      // Keep the certificate usable even if the logo cannot be loaded.
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.setTextColor(25, 45, 65);
    pdf.text("CLEIDSON DIESEL", 49, 24);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Bomba injetora e injeção diesel", 49, 31);
    pdf.text("WhatsApp: (71) 98657-1661", 49, 37);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("CERTIFICADO DE GARANTIA", margin, 61);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(90, 100, 110);
    pdf.text(`Ordem de serviço nº ${order?.number ?? "—"}`, margin, 68);
    pdf.text(warrantyState(w.start_date, w.end_date, todayISO()).toUpperCase(), pageWidth - margin, 68, { align: "right" });
    pdf.setTextColor(25, 35, 45);
    y = 80;
  };

  const ensureSpace = async (height: number) => {
    if (y + height <= 275) return;
    pdf.addPage();
    y = 18;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(25, 45, 65);
    pdf.text(`CLEIDSON DIESEL · CERTIFICADO DE GARANTIA · OS ${order?.number ?? "—"}`, margin, y);
    pdf.setDrawColor(35, 75, 105);
    pdf.line(margin, y + 4, pageWidth - margin, y + 4);
    y += 14;
  };

  const section = async (title: string, value: string) => {
    await ensureSpace(18);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(35, 75, 105);
    pdf.text(title.toUpperCase(), margin, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(30, 35, 40);
    const lines = pdf.splitTextToSize(value || "Não informado", contentWidth) as string[];
    for (const line of lines) {
      await ensureSpace(6);
      pdf.text(line, margin, y);
      y += 5;
    }
    y += 5;
  };

  await addHeader();
  await section("Dados do cliente", `Cliente: ${order?.customer_name || "—"}\nTelefone: ${order?.phone || "—"}`);
  await section("Identificação do veículo", `Veículo: ${[order?.vehicle, order?.vehicle_year].filter(Boolean).join(" ") || "—"}\nPlaca: ${formatPlate(order?.plate ?? "") || "—"}`);
  await section("Período da garantia", `Início: ${formatDateBR(w.start_date)}\nVencimento: ${formatDateBR(w.end_date)}\nPrazo: ${w.duration_months} meses`);
  await section("Peças e serviços cobertos", w.coverage || "Não informado");
  await section("Condições e observações", w.terms || "Não informado");

  await ensureSpace(32);
  y += 12;
  pdf.setDrawColor(80, 85, 90);
  pdf.line(margin + 4, y, margin + 72, y);
  pdf.line(pageWidth - margin - 72, y, pageWidth - margin - 4, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Assinatura do cliente", margin + 38, y + 6, { align: "center" });
  pdf.text("Cleidson Diesel", pageWidth - margin - 38, y + 6, { align: "center" });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 125, 130);
    pdf.text(`Cleidson Diesel · Garantia OS ${order?.number ?? "—"} · ${page}/${pageCount}`, pageWidth / 2, 287, { align: "center" });
  }
  pdf.setProperties({
    title: `Certificado de garantia OS ${order?.number ?? ""} — Cleidson Diesel`,
    author: "Cleidson Diesel",
    subject: "Certificado de garantia de peças e serviços",
  });
  pdf.save(`certificado-garantia-cleidson-diesel-OS-${order?.number ?? "sem-numero"}.pdf`);
}

function Certificate() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(warrantiesQuery());
  const w = data.find((entry) => entry.id === id);
  if (!w) return <p>Garantia não encontrada.</p>;
  const o = w.service_orders;

  async function handlePdfDownload() {
    try {
      if (w) await downloadWarrantyPdf(w);
    } catch (error) {
      console.error("Falha ao gerar certificado de garantia:", error);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3 print:hidden">
        <Button asChild variant="ghost">
          <Link to="/painel/garantias"><ArrowLeft />Garantias</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer />Imprimir</Button>
          <Button onClick={() => void handlePdfDownload()}><FileDown />Baixar PDF</Button>
        </div>
      </div>
      <article className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4 border-b-2 border-primary pb-5">
          <img src={logo.url} alt="Cleidson Diesel" className="size-16 rounded-full object-cover" />
          <div>
            <p className="font-display text-2xl uppercase">Cleidson Diesel</p>
            <p className="text-sm text-muted-foreground">Bomba injetora e injeção diesel</p>
            <p className="text-sm">WhatsApp: (71) 98657-1661</p>
          </div>
        </div>
        <div>
          <h1 className="text-2xl">Certificado de garantia</h1>
          <p className="mt-2 text-sm text-muted-foreground">OS nº {o?.number} · {warrantyState(w.start_date, w.end_date, todayISO())}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <p><strong>Cliente:</strong> {o?.customer_name}</p>
          <p><strong>Telefone:</strong> {o?.phone || "—"}</p>
          <p><strong>Veículo:</strong> {o?.vehicle} {o?.vehicle_year}</p>
          <p><strong>Placa:</strong> {formatPlate(o?.plate ?? "")}</p>
          <p><strong>Início:</strong> {formatDateBR(w.start_date)}</p>
          <p><strong>Vencimento:</strong> {formatDateBR(w.end_date)}</p>
          <p><strong>Prazo:</strong> {w.duration_months} meses</p>
        </div>
        <section className="border-t border-border pt-4">
          <h2 className="text-base">Peças e serviços cobertos</h2>
          <p className="mt-2 whitespace-pre-wrap">{w.coverage || "Não informado"}</p>
        </section>
        <section className="border-t border-border pt-4">
          <h2 className="text-base">Condições e observações</h2>
          <p className="mt-2 whitespace-pre-wrap">{w.terms || "Não informado"}</p>
        </section>
        <div className="grid grid-cols-2 gap-8 pt-16 text-center text-sm">
          <p className="border-t border-foreground pt-2">Cliente</p>
          <p className="border-t border-foreground pt-2">Cleidson Diesel</p>
        </div>
      </article>
    </div>
  );
}
