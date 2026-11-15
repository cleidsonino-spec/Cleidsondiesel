import postgres from "postgres";
import { mkdir, writeFile } from "node:fs/promises";

const DATABASE_URL = process.env.SUPABASE_DB_URL;
if (!DATABASE_URL) throw new Error("Missing SUPABASE_DB_URL GitHub secret.");

const ENGINE_ID = "525526ba-dcac-4209-8df1-a52327911686";
const DOCUMENT_ID = "9b212ef6-783f-4032-9327-1441b2f1585f";
const EXPECTED_TOTAL = 532;
const REQUIRED_COLUMNS = ["engine_id", "document_id", "fault_code", "fault_name", "source_section", "information_status", "notes"];

const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 15, idle_timeout: 5, prepare: false });

const checks = [];
const add = (name, passed, detail) => checks.push({ name, passed, detail });

try {
  await sql.begin(async (tx) => {
    await tx.unsafe("SET TRANSACTION READ ONLY");
    const columns = await tx.unsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'technical_fault_codes'"
    );
    const available = new Set(columns.map((c) => c.column_name));
    const missing = REQUIRED_COLUMNS.filter((c) => !available.has(c));
    add("schema_required_columns", missing.length === 0, missing.length ? "Missing columns: " + missing.join(", ") : "All expected columns exist.");
    if (missing.length) throw new Error("Table schema does not match expected catalog contract.");

    const rows = await tx.unsafe(
      "SELECT engine_id, document_id, fault_code, fault_name, source_section, information_status, notes " +
      "FROM public.technical_fault_codes WHERE engine_id = $1::uuid AND document_id = $2::uuid ORDER BY fault_code",
      [ENGINE_ID, DOCUMENT_ID]
    );
    const codes = rows.map((r) => r.fault_code);
    const duplicates = codes.length - new Set(codes).size;
    const invalidStatus = rows.filter((r) => !["pending_validation", "documented", "workshop_experience"].includes(r.information_status)).length;
    const missingName = rows.filter((r) => !r.fault_name?.trim()).length;
    const missingSource = rows.filter((r) => !r.source_section?.trim()).length;

    add("expected_catalog_count", rows.length === EXPECTED_TOTAL, "Found " + rows.length + "; expected " + EXPECTED_TOTAL + ".");
    add("unique_fault_codes", duplicates === 0, duplicates + " duplicate code(s).");
    add("allowed_information_status", invalidStatus === 0, invalidStatus + " record(s) with unknown status.");
    add("fault_name_present", missingName === 0, missingName + " record(s) without fault_name.");
    add("source_section_present", missingSource === 0, missingSource + " record(s) without source_section.");

    const statusCounts = Object.fromEntries(["pending_validation", "documented", "workshop_experience"].map((status) => [status, rows.filter((r) => r.information_status === status).length]));
    const report = {
      generatedAt: new Date().toISOString(),
      mode: "read-only-audit",
      engineId: ENGINE_ID,
      documentId: DOCUMENT_ID,
      expectedTotal: EXPECTED_TOTAL,
      actualTotal: rows.length,
      statusCounts,
      checks,
      passed: checks.every((c) => c.passed),
      safety: { databaseTransactionReadOnly: true, writesPerformed: false, existingRecordsModified: false }
    };

    await mkdir("artifacts", { recursive: true });
    await writeFile("artifacts/cummins-obd-audit.json", JSON.stringify(report, null, 2));
    await writeFile("artifacts/cummins-obd-audit.md", [
      "# Cummins OBD catalog audit", "",
      "- Generated: " + report.generatedAt,
      "- Records found: " + rows.length + "/" + EXPECTED_TOTAL,
      "- Status counts: " + JSON.stringify(statusCounts),
      "- Result: " + (report.passed ? "PASS" : "FAIL"), "",
      ...checks.map((c) => "- [" + (c.passed ? "x" : " ") + "] " + c.name + ": " + c.detail),
      "", "Read-only audit. No database writes were performed."
    ].join("\n"));
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) throw new Error("Catalog audit failed; see artifacts.");
  });
} finally {
  await sql.end({ timeout: 5 });
}
