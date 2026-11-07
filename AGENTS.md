<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Panel access is decided by `public.user_roles` (`has_role(uid,'admin')`); a signup trigger makes the first account admin, later accounts get `user` and see a no-access screen. Why: shop has a single owner and no user-management UI.
- Public plate lookup and free-slot lookup go only through SECURITY DEFINER RPCs (`lookup_plate`, `booked_slots`) that return limited fields; anon has INSERT-only on `appointments` and no access to `service_orders`. Why: customers must never read phones or prices of other vehicles.
- Business rules (plate format, opening slots, totals, WhatsApp message text) live in `src/lib/*.ts` and are covered by `src/test/rules.test.ts`. Why: keep them pure and testable.
- WhatsApp messages are sent via `wa.me` links built in `src/lib/whatsapp.ts`, not an API. Why: works immediately without a WhatsApp Business account.
- Itemized parts are stored on each order as JSON, with pure helpers in `src/lib/parts.ts` and a database trigger deriving the aggregate; null lists retain legacy totals. Why: keep editing, printing and quotes consistent without losing existing orders.
