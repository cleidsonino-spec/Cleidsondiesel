import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("GitHub Actions secret DATABASE_URL is missing.");
}

const sql = neon(connectionString);
const rows = await sql`select 1 as ok`;

if (Number(rows[0]?.ok) !== 1) {
  throw new Error("Neon connection test returned an unexpected result.");
}

console.log("Neon database connection verified successfully.");
