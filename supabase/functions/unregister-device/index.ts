import { json, requireAdmin } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const { supabase, user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const { data, error } = await supabase.auth.admin.getUserById(user.id);
    if (error || !data.user) return json({ error: "USER_NOT_FOUND" }, 404);
    const metadata = { ...(data.user.app_metadata ?? {}) };
    const stored = Array.isArray(metadata.cleidson_diesel_fcm_tokens) ? metadata.cleidson_diesel_fcm_tokens : [];
    if (!token) {
      delete metadata.cleidson_diesel_fcm_tokens;
    } else {
      metadata.cleidson_diesel_fcm_tokens = stored.filter((value: unknown) => value !== token);
      if (metadata.cleidson_diesel_fcm_tokens.length === 0) delete metadata.cleidson_diesel_fcm_tokens;
    }
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: metadata });
    if (updateError) return json({ error: "TOKEN_REMOVE_FAILED" }, 500);
    return json({ unregistered: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "AUTH_REQUIRED" || message === "AUTH_INVALID" ? 401 : message === "ADMIN_REQUIRED" ? 403 : 500;
    return json({ error: status === 500 ? "INTERNAL_ERROR" : message }, status);
  }
});
