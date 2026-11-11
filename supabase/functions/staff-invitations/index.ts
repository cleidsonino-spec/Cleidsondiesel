import { corsHeaders, json, requireAdmin, adminClient } from "../_shared/push.ts";

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }

  const action = clean(body.action, 20);

  if (action === "accept") {
    const token = clean(body.token, 200);
    const password = typeof body.password === "string" ? body.password : "";
    if (token.length < 32 || password.length < 8 || password.length > 128) {
      return json({ error: "INVALID_INVITATION_OR_PASSWORD" }, 400);
    }

    const supabase = adminClient();
    const tokenHash = await sha256(token);
    const now = new Date().toISOString();
    const { data: invitation, error: claimError } = await supabase
      .from("staff_invitations")
      .update({ used_at: now })
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .select("id, full_name, email, phone, role")
      .maybeSingle();

    if (claimError || !invitation) return json({ error: "INVITATION_INVALID_OR_EXPIRED" }, 410);

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: invitation.full_name, phone: invitation.phone },
    });

    if (createError || !created.user) {
      await supabase.from("staff_invitations").update({ used_at: null }).eq("id", invitation.id);
      const duplicate = createError?.message?.toLowerCase().includes("already");
      return json({ error: duplicate ? "EMAIL_ALREADY_REGISTERED" : "ACCOUNT_CREATION_FAILED" }, duplicate ? 409 : 400);
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: created.user.id,
      role: invitation.role,
    });

    if (roleError) {
      await supabase.auth.admin.deleteUser(created.user.id);
      await supabase.from("staff_invitations").update({ used_at: null }).eq("id", invitation.id);
      return json({ error: "ROLE_ASSIGNMENT_FAILED" }, 500);
    }

    return json({ accepted: true });
  }

  try {
    const { supabase, user } = await requireAdmin(req);

    if (action === "create") {
      const full_name = clean(body.full_name, 100);
      const email = clean(body.email, 254).toLowerCase();
      const phone = clean(body.phone, 30);
      const role = clean(body.role, 20);
      if (full_name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          phone.replace(/\D/g, "").length < 10 || !["mecanico", "secretaria"].includes(role)) {
        return json({ error: "INVALID_INVITATION_DATA" }, 400);
      }

      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const token = [...tokenBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const token_hash = await sha256(token);
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("staff_invitations").insert({
        full_name, email, phone, role, token_hash, created_by: user.id, expires_at,
      }).select("id, full_name, email, phone, role, created_at, expires_at").single();

      if (error || !data) return json({ error: "INVITATION_CREATE_FAILED" }, 500);
      return json({ invitation: data, token });
    }

    if (action === "list") {
      const { data, error } = await supabase.from("staff_invitations")
        .select("id, full_name, email, phone, role, created_at, expires_at, used_at, revoked_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) return json({ error: "INVITATION_LIST_FAILED" }, 500);
      return json({ invitations: data ?? [] });
    }

    if (action === "revoke") {
      const id = clean(body.id, 50);
      const { data, error } = await supabase.from("staff_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id).is("used_at", null).is("revoked_at", null)
        .select("id").maybeSingle();
      if (error || !data) return json({ error: "INVITATION_NOT_REVOCABLE" }, 409);
      return json({ revoked: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "AUTH_REQUIRED" || message === "AUTH_INVALID" ? 401 : message === "ADMIN_REQUIRED" ? 403 : 500;
    return json({ error: status === 500 ? "INTERNAL_ERROR" : message }, status);
  }
});
