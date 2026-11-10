import { corsHeaders, json, requireAdmin } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const { supabase, user } = await requireAdmin(req);
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (token.length < 20 || token.length > 4096) return json({ error: "INVALID_TOKEN" }, 400);

    const { data, error } = await supabase.auth.admin.getUserById(user.id);
    if (error || !data.user) return json({ error: "USER_NOT_FOUND" }, 404);
    const metadata = data.user.app_metadata ?? {};
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...metadata,
        cleidson_diesel_fcm_tokens: [...new Set([
          ...(Array.isArray(metadata.cleidson_diesel_fcm_tokens) ? metadata.cleidson_diesel_fcm_tokens.filter((value: unknown) => typeof value === "string") : []),
          token,
        ])].slice(-10),
      },
    });
    if (updateError) return json({ error: "TOKEN_SAVE_FAILED" }, 500);
    return json({ registered: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "AUTH_REQUIRED" || message === "AUTH_INVALID" ? 401 : message === "ADMIN_REQUIRED" ? 403 : 500;
    return json({ error: status === 500 ? "INTERNAL_ERROR" : message }, status);
  }
});
