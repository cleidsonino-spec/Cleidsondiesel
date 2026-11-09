import { z } from "zod";

export const inspectionDiagnosisInput = z.object({
  vehicle: z.string().trim().max(200),
  vehicle_year: z.string().trim().max(20),
  complaint: z.string().trim().max(3000),
  items: z.array(z.object({
    label: z.string().trim().min(1).max(200),
    status: z.enum(["pending", "ok", "attention", "failed", "na"]),
    notes: z.string().trim().max(1500),
  }).strict()).min(1).max(40),
}).strict().refine((v) => v.items.some((i) => i.status === "failed" || i.status === "attention" || i.notes.length > 0), {
  message: "Informe um item reprovado, uma atenção ou observações da inspeção.",
});

export const inspectionDiagnosisOutput = z.object({
  diagnosis: z.string().trim().min(1).max(4000),
  recommendations: z.array(z.string().trim().min(1).max(800)).min(1).max(8),
  checks: z.array(z.string().trim().min(1).max(800)).max(8),
}).strict();

export type InspectionDiagnosis = z.infer<typeof inspectionDiagnosisOutput>;

export function diagnosisText(result: InspectionDiagnosis) {
  return [result.diagnosis, "Recomendações:", ...result.recommendations.map((r) => `• ${r}`),
    ...(result.checks.length ? ["Verificações necessárias:", ...result.checks.map((c) => `• ${c}`)] : [])].join("\n");
}