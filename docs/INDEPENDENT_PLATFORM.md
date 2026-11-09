# Independent Cleidson Diesel platform

## Goal
Build a standalone web application and Android app without depending on Lovable at runtime. The current production app remains untouched during the transition.

## Architecture
- Web client: existing React/TanStack application, migrated in controlled stages.
- Android: Capacitor wrapper, later pointed to the independently hosted web application.
- API: authenticated server endpoints; database credentials stay on the server.
- Database: PostgreSQL, hosted by a provider selected by the owner.
- Source control: GitHub stores source code and versioned SQL migrations only. It is not the live database host.

## Initial data model
The first migration creates:
- customers
- vehicles
- work_orders
- work_order_items
- payments
- warranties

Customer records are retained when referenced by vehicles or work orders. Work-order items are removed only when their parent work order is removed. Payments and warranties prevent deletion of a referenced work order.

## Warranty rule
Warranty starts on the service completion/delivery date. Its expiration is the last calendar day of the month reached after adding three calendar months.

Example: completion on 2026-11-09 => warranty expires on 2027-02-28.

The API must calculate and store the start and expiration dates when a work order is completed. The browser must not be trusted to calculate or authorize warranty changes.

## Security requirements before production
1. Choose and provision a managed PostgreSQL host.
2. Store the database connection string only as a server-side secret.
3. Implement administrator authentication and authorization on the server.
4. Do not expose database credentials, service keys, or unrestricted database access in browser code or the APK.
5. Add backups and test a restore before importing any real customer data.
6. Review and test migrations against a disposable database before production.
7. Keep the current live app available until the replacement has been tested and approved.

## Current status
This repository change is a schema and architecture foundation only. It does not provision a database, migrate existing records, deploy an API, change the production website, or change the Android app.
