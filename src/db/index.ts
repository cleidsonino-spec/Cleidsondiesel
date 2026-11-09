import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../drizzle/schema";

/**
 * Create a Neon HTTP database client for the current Worker request.
 * Pass the DATABASE_URL Worker secret; never read credentials from source code.
 */
export function createDb(connectionString: string) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to the independent PostgreSQL database.");
  }

  const client = neon(connectionString);
  return drizzle({ client, schema });
}
