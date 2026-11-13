const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  },
});

async function authenticatedStaff(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization };
  const response = await fetch(env.SUPABASE_URL + "/auth/v1/user", { headers });
  if (!response.ok) return null;
  const user = await response.json();
  const roles = await Promise.all(["admin", "secretaria", "mecanico"].map(async (role) => {
    const result = await fetch(env.SUPABASE_URL + "/rest/v1/rpc/has_role", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ _user_id: user.id, _role: role }),
    });
    return result.ok && await result.json() === true ? role : null;
  }));
  const activeRoles = roles.filter(Boolean);
  return activeRoles.length ? { ...user, roles: activeRoles } : null;
}

function base64url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
}

function privateKeyBytes(value) {
  const clean = value.replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "").replaceAll("\n", "")
    .replaceAll("\r", "").replaceAll(" ", "").replaceAll("\t", "");
  return Uint8Array.from(atob(clean), (char) => char.charCodeAt(0));
}

async function firebaseAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    base64url(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  ));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + base64url(signature),
    }),
  });
  if (!response.ok) throw new Error("FIREBASE_AUTH_FAILED");
  return (await response.json()).access_token;
}

const value = (input, fallback = "") =>
  typeof input === "string" && input.trim() ? input.trim() : fallback;

function customerVehicle(record) {
  const customer = value(record.customer_name, "Cliente");
  const vehicle = value(record.vehicle, "");
  const plate = value(record.plate, "");
  return "Cliente: " + customer +
    (vehicle ? " · Veículo: " + vehicle : "") +
    (plate ? " · Placa: " + plate : "");
}

function orderMessage(title, lead, order, route) {
  const number = value(String(order.number ?? ""), "—");
  return {
    title,
    body: lead + " OS nº " + number + " · " + customerVehicle(order),
    route,
    recipientUserIds: [],
    broadcastAdmins: false,
  };
}

function notificationFor(payload) {
  const table = String(payload.table || "");
  const event = String(payload.type || "").toUpperCase();
  const record = payload.record || {};
  const oldRecord = payload.old_record || {};

  if (table === "service_order_assignments" &&
      (event === "INSERT" || event === "UPDATE") &&
      record.active === true && typeof record.mechanic_user_id === "string") {
    const order = record.service_order || {};
    const id = value(record.service_order_id, order.id);
    if (!id) return null;
    const message = orderMessage(
      "Nova ordem de serviço atribuída!",
      "Você recebeu uma nova OS.",
      order,
      "/equipe?os=" + encodeURIComponent(id),
    );
    message.recipientUserIds = [record.mechanic_user_id];
    return message;
  }

  if (table === "service_orders" && event === "UPDATE" &&
      oldRecord.status !== "em_servico" && record.status === "em_servico" &&
      Array.isArray(record.mechanic_user_ids)) {
    const recipients = [...new Set(record.mechanic_user_ids.filter((id) => typeof id === "string"))];
    if (!recipients.length) return null;
    const message = orderMessage(
      "Seu serviço está autorizado!",
      "A oficina autorizou o início do serviço.",
      record,
      "/equipe?os=" + encodeURIComponent(String(record.id)),
    );
    message.recipientUserIds = recipients;
    return message;
  }

  if (table === "appointments" && event === "INSERT") {
    return {
      title: "Novo agendamento",
      body: customerVehicle(record) + " solicitou um horário para " +
        value(record.scheduled_time, "horário não informado") + ".",
      route: "/painel/agendamentos",
      broadcastAdmins: true,
    };
  }

  if (table === "service_order_inspection_reports" &&
      (event === "INSERT" || event === "UPDATE") &&
      record.status === "pending_review" &&
      (event === "INSERT" || oldRecord.status !== "pending_review")) {
    const order = record.service_order || {};
    const orderId = value(record.service_order_id, order.id);
    if (!orderId) return null;
    return {
      title: "Relatório técnico enviado para revisão",
      body: "O mecânico enviou o relatório da OS nº " + value(String(order.number ?? ""), "—") +
        " para revisão. " + customerVehicle(order),
      route: "/painel/ordens/" + orderId,
      broadcastAdmins: true,
    };
  }

  if (table === "service_orders" && event === "INSERT") {
    return {
      title: "Nova ordem de serviço",
      body: "OS nº " + value(String(record.number ?? ""), "—") + " · " +
        customerVehicle(record) + " · cadastrada.",
      route: "/painel/ordens/" + record.id,
      broadcastAdmins: true,
    };
  }

  if (table === "service_orders" && event === "UPDATE" &&
      oldRecord.status !== "aguardando_aprovacao" && record.status === "aguardando_aprovacao") {
    return {
      title: "Diagnóstico do mecânico enviado",
      body: "O diagnóstico da OS nº " + value(String(record.number ?? ""), "—") +
        " foi enviado e aguarda revisão. " + customerVehicle(record),
      route: "/painel/ordens/" + record.id,
      broadcastAdmins: true,
    };
  }

  if (table === "service_orders" && event === "UPDATE" &&
      oldRecord.status !== "pronto" && record.status === "pronto") {
    return {
      title: "Veículo pronto para retirada",
      body: "OS nº " + value(String(record.number ?? ""), "—") + " · " +
        customerVehicle(record) + " · serviço concluído.",
      route: "/painel/ordens/" + record.id,
      broadcastAdmins: true,
    };
  }

  if (table === "warranties" && event === "INSERT") {
    return {
      title: "Garantia emitida",
      body: "Uma nova garantia foi registrada.",
      route: "/painel/garantias",
      broadcastAdmins: true,
    };
  }

  if (table === "notification_events" && event === "INSERT") {
    return {
      title: typeof record.title === "string" ? record.title.slice(0, 120) : "Notificação Cleidson Diesel",
      body: typeof record.body === "string" ? record.body.slice(0, 500) : "Você tem uma nova atualização.",
      route: typeof record.route === "string" && record.route.startsWith("/painel")
        ? record.route
        : "/painel",
      broadcastAdmins: true,
    };
  }

  return null;
}

async function tokensForUser(env, prefix, userId) {
  const tokens = await env.PUSH_TOKENS.get(prefix + userId, "json");
  return Array.isArray(tokens) ? tokens.filter((token) =>
    typeof token === "string" && token.length > 20
  ) : [];
}

async function sendPush(env, message) {
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("FIREBASE_CREDENTIALS_INVALID");
  }

  const tokenSet = new Set();
  if (message.broadcastAdmins) {
    const listing = await env.PUSH_TOKENS.list({ prefix: "admin:" });
    for (const key of listing.keys) {
      for (const token of await tokensForUser(env, "admin:", key.name.slice("admin:".length))) {
        tokenSet.add(token);
      }
    }
  }
  for (const userId of message.recipientUserIds || []) {
    for (const token of await tokensForUser(env, "mechanic:", userId)) tokenSet.add(token);
  }

  const accessToken = await firebaseAccessToken(serviceAccount);
  const results = await Promise.all([...tokenSet].map(async (token) => {
    const response = await fetch(
      "https://fcm.googleapis.com/v1/projects/" + serviceAccount.project_id + "/messages:send",
      {
        method: "POST",
        headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, body: message.body },
            data: { route: message.route },
            android: { priority: "HIGH" },
          },
        }),
      },
    );
    if (response.ok) return { ok: true };
    let failure = {};
    try { failure = await response.json(); } catch { /* resposta sem JSON */ }
    const fcmError = failure.error || {};
    const detail = Array.isArray(fcmError.details)
      ? fcmError.details.find((item) => typeof item.errorCode === "string")
      : null;
    return {
      ok: false,
      httpStatus: response.status,
      code: typeof detail?.errorCode === "string" ? detail.errorCode : value(fcmError.status, "FCM_SEND_FAILED"),
    };
  }));

  return {
    sent: results.filter((item) => item.ok).length,
    attempted: results.length,
    failures: results.filter((item) => !item.ok).map(({ httpStatus, code }) => ({ httpStatus, code })),
  };
}

async function updateDeviceRegistration(request, env, user, path) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 20 || token.length > 4096) return json({ error: "INVALID_TOKEN" }, 400);

  const prefixes = [];
  if (user.roles.includes("admin") || user.roles.includes("secretaria")) prefixes.push("admin:");
  if (user.roles.includes("mecanico")) prefixes.push("mechanic:");

  let registeredCount = 0;
  for (const prefix of prefixes) {
    const key = prefix + user.id;
    const existing = await env.PUSH_TOKENS.get(key, "json") || [];
    const next = path === "/register"
      ? [...new Set([...existing, token])].slice(-10)
      : existing.filter((item) => item !== token);
    if (next.length) await env.PUSH_TOKENS.put(key, JSON.stringify(next));
    else await env.PUSH_TOKENS.delete(key);
    registeredCount += next.length;
  }
  return json({ registered: path === "/register", categories: prefixes.length, count: registeredCount });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "cleidson-diesel-push", status: "ready" });
    }
    if (request.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, apikey, content-type",
          "access-control-allow-methods": "GET, POST, OPTIONS",
        },
      });
    }
    if (request.method !== "POST") return json({ error: "NOT_FOUND" }, 404);

    if (url.pathname === "/register" || url.pathname === "/unregister") {
      const user = await authenticatedStaff(request, env);
      if (!user) return json({ error: "STAFF_REQUIRED" }, 403);
      return updateDeviceRegistration(request, env, user, url.pathname);
    }

    if (url.pathname === "/notify") {
      if (!env.PUSH_WEBHOOK_SECRET || request.headers.get("x-webhook-secret") !== env.PUSH_WEBHOOK_SECRET) {
        return json({ error: "UNAUTHORIZED" }, 401);
      }
      try {
        const payload = await request.json();
        const message = notificationFor(payload);
        return message ? json(await sendPush(env, message)) : json({ ignored: true });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "NOTIFICATION_FAILED" }, 500);
      }
    }

    return json({ error: "NOT_FOUND" }, 404);
  },
};
