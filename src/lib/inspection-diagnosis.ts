import { z } from "zod";

export const inspectionDiagnosisInput = z.object({
  vehicle: z.string().trim().max(200),
  vehicle_year: z.string().trim().max(20),
  complaint: z.string().trim().max(3000),
  failed_items: z.string().trim().max(5000),
  observations: z.string().trim().max(5000),
}).strict().refine((v) => v.failed_items.length > 0 || v.observations.length > 0, {
  message: "Informe pelo menos um item reprovado ou uma observação da inspeção.",
});

export const inspectionDiagnosisOutput = z.object({
  diagnosis: z.string().trim().min(1).max(1200),
}).strict();

export type InspectionDiagnosis = z.infer<typeof inspectionDiagnosisOutput>;

export function diagnosisText(result: InspectionDiagnosis) {
  return result.diagnosis;
}
