import { mkdir, writeFile } from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY GitHub secret.");
}
if (!/^https:\\/\\/[a-z0-9-]+\\.supabase\\.co$/i.test(SUPABASE_URL)) {
  throw new Error("SUPABASE_URL must be the project's HTTPS URL.");
}

const ENGINE_ID = "525526ba-dcac-4209-8df1-a52327911686";
const DOCUMENT_ID = "9b212ef6-783f-4032-9327-1441b2f1585f";
const EXPECTED_TOTAL = 532;
const REQUIRED_COLUMNS = ["engine_id", "document_id", "fault_code", "fault_name", "source_section", "information_status", "notes"];

const endpoint = new URL("/rest/v1/technical_fault_codes", SUPABASE_URL);
endpoint.searchParams.set("select", REQUIRED_COLUMNS.join(","));
endpoint.searchParams.set("engine_id", "eq." + ENGINE_ID);
endpoint.searchParams.set("document_id", "eq." + DOCUMENT_ID);
endpoint.searchParams.set("order", "fault_code.asc");

const response = await fetch(endpoint, {
  method: "GET",
  headers: {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Accept: "application/json",
    Prefer: "count=exact",
    Range: "0-999"
  },
  signal: AbortSignal.timeout(20000)
});

if (!response.ok) {
  const body = await response.text();
  throw new Error("Supabase REST request failed (" + response.status + "): " + body.slice(0, 1200));
}
const rows = await response.json();
if (!Array.isArray(rows)) throw new Error("Supabase REST returned an unexpected response.");
const contentRange = response.headers.get("content-range");
const countMatch = contentRange?.match(/\\/(\\d+)$/);
const exactCount = countMatch ? Number(countMatch[1]) : rows.length;

const checks = [];
const add = (name, passed, detail) => checks.push({ name, passed, detail });
add("expected_catalog_count", exactCount === EXPECTED_TOTAL, "API count: " + exactCount + "; expected " + EXPECTED_TOTAL + ".");
add("all_rows_retrieved", rows.length === exactCount, "Retrieved " + rows.length + " row(s) from total " + exactCount + ".");
const codes = rows.map((r) => r.fault_code);
const duplicates = codes.length - new Set(codes).size;
const invalidStatus = rows.filter((r) => !["pending_validation", "documented", "workshop_experience"].includes(r.information_status)).length;
const missingName = rows.filter((r) => !r.fault_name?.trim()).length;
const missingSource = rows.filter((r) => !r.source_section?.trim()).length;
add("unique_fault_codes", duplicates === 0, duplicates + " duplicate code(s).");
add("allowed_information_status", invalidStatus === 0, invalidStatus + " record(s) with unknown status.");
add("fault_name_present", missingName === 0, missingName + " record(s) without fault_name.");
add("source_section_present", missingSource === 0, missingSource + " record(s) without source_section.");

const statusCounts = Object.fromEntries(["pending_validation", "documented", "workshop_experience"].map((status) => [status, rows.filter((r) => r.information_status === status).length]));
const report = {
  generatedAt: new Date().toISOString(),
  mode: "read-only-supabase-rest-audit",
  engineId: ENGINE_ID,
  documentId: DOCUMENT_ID,
  expectedTotal: EXPECTED_TOTAL,
  actualTotal: exactCount,
  retrievedRows: rows.length,
  statusCounts,
  checks,
  passed: checks.every((c) => c.passed),
  safety: {
    transport: "Supabase HTTPS REST API",
    databaseConnectionStringRequired: false,
    databaseWritesPerformed: false,
    existingRecordsModified: false
  }
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/cummins-obd-audit.json", JSON.stringify(report, null, 2));
await writeFile("artifacts/cummins-obd-audit.md", [
  "# Cummins OBD catalog audit", "",
  "- Generated: " + report.generatedAt,
  "- Records found: " + exactCount + "/" + EXPECTED_TOTAL,
  "- Rows retrieved: " + rows.length,
  "- Status counts: " + JSON.stringify(statusCounts),
  "- Result: " + (report.passed ? "PASS" : "FAIL"), "",
  ...checks.map((c) => "- [" + (c.passed ? "x" : " ") + "] " + c.name + ": " + c.detail),
  "", "Read-only REST GET. No database writes were performed."
].join("\\n"));
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
