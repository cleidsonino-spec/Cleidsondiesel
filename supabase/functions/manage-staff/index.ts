import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const adminClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const staffEmail = (username: string) => `${username}@staff.cleidsondiesel.invalid`;

async function requireAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\\s+/i, "");
  if (!token) throw new Error("AUTH_REQUIRED");
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("AUTH_INVALID");
  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError || isAdmin !== true) throw new Error("ADMIN_REQUIRED");
  return supabase;
}

async function listStaff(supabase: ReturnType<typeof adminClient>) {
  const staff: Record<string, unknown>[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    for (const user of data.users) {
      const metadata = user.app_metadata ?? {};
      const role = metadata.staff_role;
      if (role !== "secretaria" && role !== "mecanico") continue;
      staff.push({
        id: user.id,
        username: user.user_metadata?.username ?? "",
        full_name: user.user_metadata?.full_name ?? "",
        role,
        status: metadata.staff_status ?? (user.banned_until ? "blocked" : "active"),
        created_at: user.created_at,
      });
    }
    if (data.users.length < 100) break;
  }
  return staff.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), "pt-BR"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabase = await requireAdmin(req);
    const body = await req.json();
    const action = String(body?.action ?? "");

    if (action === "list") {
      return json({ staff: await listStaff(supabase) });
    }

    if (action === "create") {
      const username = String(body?.username ?? "").trim().toLowerCase();
      const fullName = String(body?.full_name ?? "").trim();
      const password = String(body?.password ?? "");
      const role = body?.role;
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) return json({ error: "INVALID_USERNAME" }, 400);
      if (fullName.length < 2 || fullName.length > 100) return json({ error: "INVALID_NAME" }, 400);
      if (password.length < 12 || password.length > 128) return json({ error: "WEAK_PASSWORD" }, 400);
      if (role !== "secretaria" && role !== "mecanico") return json({ error: "INVALID_ROLE" }, 400);

      const email = staffEmail(username);
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, full_name: fullName },
        app_metadata: { staff_role: role, staff_status: "active" },
      });
      if (createError || !created.user) {
        return json({ error: createError?.message.includes("already") ? "USERNAME_TAKEN" : "CREATE_FAILED" }, 400);
      }

      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: created.user.id,
        role,
      });
      if (roleError) {
        await supabase.auth.admin.deleteUser(created.user.id);
        return json({ error: "ROLE_ASSIGNMENT_FAILED" }, 500);
      }
      return json({ created: true, id: created.user.id });
    }

    const userId = String(body?.user_id ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: "INVALID_USER" }, 400);
    }

    const { data: result, error: getError } = await supabase.auth.admin.getUserById(userId);
    if (getError || !result.user) return json({ error: "USER_NOT_FOUND" }, 404);
    const target = result.user;
    const metadata = target.app_metadata ?? {};
    const role = metadata.staff_role;
    if (role !== "secretaria" && role !== "mecanico") return json({ error: "NOT_STAFF_ACCOUNT" }, 400);
    if (target.id === (await supabase.auth.getUser((req.headers.get("Authorization") ?? "").replace(/^Bearer\\s+/i, ""))).data.user?.id) {
      return json({ error: "CANNOT_MANAGE_SELF" }, 400);
    }

    if (action === "block") {
      const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
        app_metadata: { ...metadata, staff_status: "blocked" },
      });
      if (banError) return json({ error: "BLOCK_FAILED" }, 500);
      const { error: roleError } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (roleError) {
        await supabase.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
        return json({ error: "BLOCK_ROLE_FAILED" }, 500);
      }
      return json({ blocked: true });
    }

    if (action === "unblock") {
      const { error: unbanError } = await supabase.auth.admin.updateUserById(userId, {
        ban_duration: "none",
        app_metadata: { ...metadata, staff_status: "active" },
      });
      if (unbanError) return json({ error: "UNBLOCK_FAILED" }, 500);
      const { error: roleError } = await supabase.from("user_roles").upsert(
        { user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true },
      );
      if (roleError) {
        await supabase.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
          app_metadata: { ...metadata, staff_status: "blocked" },
        });
        return json({ error: "UNBLOCK_ROLE_FAILED" }, 500);
      }
      return json({ unblocked: true });
    }

    if (action === "remove") {
      // Soft-delete: the employee loses all access and the username is released,
      // while auth.users references in technical history remain valid.
      const { error: removeError } = await supabase.auth.admin.updateUserById(userId, {
        email: `removed+${userId}@staff.cleidsondiesel.invalid`,
        email_confirm: true,
        ban_duration: "876000h",
        app_metadata: { ...metadata, staff_status: "removed" },
        user_metadata: { ...target.user_metadata, username: null },
      });
      if (removeError) return json({ error: "REMOVE_FAILED" }, 500);
      const { error: roleError } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (roleError) return json({ error: "REMOVE_ROLE_FAILED" }, 500);
      return json({ removed: true, history_preserved: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "AUTH_REQUIRED" || message === "AUTH_INVALID" ? 401
      : message === "ADMIN_REQUIRED" ? 403 : 500;
    return json({ error: status === 500 ? "INTERNAL_ERROR" : message }, status);
  }
});
