import postgres from "postgres";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const connectionString = process.env.CLEIDSON_DIESEL_DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing CLEIDSON_DIESEL_DATABASE_URL GitHub Actions secret.");
}

const migrationPath = "drizzle/migrations/0010_warranty_starts_on_delivery.sql";
const migration = await readFile(migrationPath);
const migrationHash = createHash("sha256").update(migration).digest("hex");
const migrationTimestamp = 1794536100000;
const expectedPreviousHash = "407b118f04a5ee55d14c0b8da25e584d63e94857a3debabfb094c2c4a09d6f45";
const expectedPreviousTimestamp = 1794499611010;

const sql = postgres(connectionString, { ssl: "require", max: 1, connect_timeout: 15 });

try {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('cleidson-diesel-drizzle-history-0010'))`;

    const ledger = await tx`
      select id, hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at desc
      limit 1
    `;

    if (ledger.length !== 1) {
      throw new Error("Migration ledger is empty or unreadable; refusing to change it.");
    }

    const latest = ledger[0];
    if (latest.hash === migrationHash && Number(latest.created_at) === migrationTimestamp) {
      console.log("Migration 0010 is already recorded. No change made.");
      return;
    }

    if (
      latest.hash !== expectedPreviousHash ||
      Number(latest.created_at) !== expectedPreviousTimestamp ||
      Number(latest.id) !== 10
    ) {
      throw new Error(
        `Unexpected migration ledger state (id=${latest.id}, created_at=${latest.created_at}, hash=${latest.hash}). Refusing to write.`,
      );
    }

    const columns = await tx`
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'service_orders'
        and column_name = 'delivered_at'
    `;
    if (columns.length !== 1) {
      throw new Error("service_orders.delivered_at is missing; migration 0010 cannot be marked applied.");
    }

    const functionRows = await tx`
      select pg_get_functiondef('public.set_service_order_delivered_at()'::regprocedure) as definition
    `;
    const definition = functionRows[0]?.definition ?? "";
    const requiredFunctionFragments = [
      "OLD.delivered_at IS NOT NULL",
      "NEW.delivered_at := OLD.delivered_at",
      "OLD.status IS DISTINCT FROM NEW.status",
    ];
    if (!requiredFunctionFragments.every((fragment) => definition.includes(fragment))) {
      throw new Error("The hardened delivered_at function was not verified; refusing to mark migration 0010 applied.");
    }

    const triggerRows = await tx`
      select pg_get_triggerdef(t.oid) as definition
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'service_orders'
        and t.tgname = 'service_order_delivered_at'
        and not t.tgisinternal
    `;
    const triggerDefinition = triggerRows[0]?.definition ?? "";
    if (
      !triggerDefinition.includes("BEFORE") ||
      !triggerDefinition.includes("INSERT") ||
      !triggerDefinition.includes("UPDATE")
    ) {
      throw new Error("The delivered_at trigger was not verified; refusing to mark migration 0010 applied.");
    }

    // Record only the migration history entry. Never execute migration SQL here.
    await tx`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      values (${migrationHash}, ${migrationTimestamp})
    `;

    const verified = await tx`
      select id, hash, created_at
      from drizzle.__drizzle_migrations
      where hash = ${migrationHash}
        and created_at = ${migrationTimestamp}
    `;
    if (verified.length !== 1) {
      throw new Error("Post-insert verification failed; transaction will roll back.");
    }

    console.log(
      `Migration 0010 history entry recorded (id=${verified[0].id}). Migration SQL was NOT executed.`,
    );
  });
} finally {
  await sql.end();
}
