# Independent platform foundation

This branch prepares the independent PostgreSQL data layer for Cleidson Diesel.

## Database

- Provider: Neon PostgreSQL (free tier to start; subject to provider limits).
- ORM: Drizzle ORM.
- Schema: `drizzle/schema.ts`.
- Initial SQL migration: `drizzle/migrations/0001_initial_workshop_schema.sql`.
- Connection variable: `DATABASE_URL`.

## Tables prepared

- `customers`: customer records.
- `vehicles`: vehicles linked to customers.
- `service_orders`: workshop service orders.
- `payments`: payments linked to service orders.
- `warranties`: warranty dates linked to service orders.

## Important

1. Never commit a real `.env` file or database password.
2. Configure `DATABASE_URL` only in the deployment provider's secret/environment settings or a private local `.env`.
3. The migration has **not** been applied to the live Neon database yet.
4. The current application still uses its existing Supabase/Lovable integration. This foundation does not switch production traffic or remove the existing login.
5. Apply the migration only after the connection is configured and verified. Back up any existing data before migration.
