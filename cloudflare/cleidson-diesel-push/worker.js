const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    },
  });

async function staff(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;

  const headers = {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    authorization,
  };
  const response = await fetch(env.SUPABASE_URL + "/auth/v1/user", { headers });
  if (!response.ok) return null;

  const user = await response.json();
  const roles = await Promise.all(
    ["admin", "secretaria"].map(async (role) => {
      const result = await fetch(env.SUPABASE_URL + "/rest/v1/rpc/has_role", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ _user_id: user.id, _role: role }),
      });
      return result.ok && (await result.json()) === true;
    }),
  );

  return roles.some(Boolean) ? user : null;
}

function base64url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
}

function privateKeyBytes(value) {
  const pem = value
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/[\\r\\n\\t ]/g, "");
  return Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
}

async function firebaseAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    base64url(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
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

const valueOr = (value, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

function vehicleLine(record) {
  const customer = valueOr(record.customer_name, "Cliente");
  const vehicle = valueOr(record.vehicle);
  const plate = valueOr(record.plate);
  return (
    "Cliente: " +
    customer +
    (vehicle ? " · Veículo: " + vehicle : "") +
    (plate ? " · Placa: " + plate : "")
  );
}

function notificationFromWebhook(payload) {
  const table = String(payload.table || "");
  const eventType = String(payload.type || "").toUpperCase();
  const record = payload.record || {};
  const oldRecord = payload.old_record || {};

  if (table === "appointments" && eventType === "INSERT") {
    return {
      title: "Novo agendamento",
      body:
        vehicleLine(record) +
        " solicitou um horário para " +
        valueOr(record.scheduled_time, "horário não informado") +
        ".",
      route: "/painel/agendamentos",
    };
  }

  if (table === "service_orders" && eventType === "INSERT") {
    return {
      title: "Nova ordem de serviço",
      body:
        "OS #" +
        valueOr(String(record.number || "")) +
        " · " +
        vehicleLine(record) +
        " · cadastrada.",
      route: "/painel/ordens/" + record.id,
    };
  }

  if (
    table === "service_orders" &&
    eventType === "UPDATE" &&
    oldRecord.status !== "aguardando_aprovacao" &&
    record.status === "aguardando_aprovacao"
  ) {
    const body =
      "Mecânico: " +
      valueOr(record.mechanic_name, "Mecânico responsável") +
      " concluiu o diagnóstico. OS nº " +
      valueOr(String(record.number || "")) +
      " · Cliente: " +
      valueOr(record.customer_name, "Não informado") +
      " · Veículo: " +
      valueOr(record.vehicle, "Não informado") +
      (record.plate ? " · Placa: " + record.plate : "");

    return {
      title: "Diagnóstico concluído!",
      body,
      route: "/painel/ordens/" + record.id,
    };
  }

  if (
    table === "service_orders" &&
    eventType === "UPDATE" &&
    oldRecord.status !== "pronto" &&
    record.status === "pronto"
  ) {
    return {
      title: "Veículo pronto para retirada",
      body:
        "OS #" +
        valueOr(String(record.number || "")) +
        " · " +
        vehicleLine(record) +
        " · serviço concluído.",
      route: "/painel/ordens/" + record.id,
    };
  }

  if (table === "warranties" && eventType === "INSERT") {
    return {
      title: "Garantia emitida",
      body: "Uma nova garantia foi registrada.",
      route: "/painel/garantias",
    };
  }

  if (table === "notification_events" && eventType === "INSERT") {
    const title =
      typeof record.title === "string"
        ? record.title.slice(0, 120)
        : "Notificação Cleidson Diesel";
    const body =
      typeof record.body === "string"
        ? record.body.slice(0, 500)
        : "Você tem uma nova atualização.";
    const route =
      typeof record.route === "string" && record.route.startsWith("/painel")
        ? record.route
        : "/painel";

    // Accept only the two notification icons and colors shipped with the APK.
    const notificationStyles = {
      ic_stat_quote_approved: "#16A34A",
      ic_stat_quote_rejected: "#DC2626",
    };
    const requestedIcon =
      typeof record.icon === "string" && Object.hasOwn(notificationStyles, record.icon)
        ? record.icon
        : null;
    const color = requestedIcon ? notificationStyles[requestedIcon] : undefined;

    return { title, body, route, icon: requestedIcon || undefined, color };
  }

  return null;
}

async function sendPush(env, notification) {
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("FIREBASE_CREDENTIALS_INVALID");
  }

  const accessToken = await firebaseAccessToken(serviceAccount);
  const tokenList = await env.PUSH_TOKENS.list({ prefix: "admin:" });
  const tokens = new Set();

  for (const key of tokenList.keys) {
    const stored = await env.PUSH_TOKENS.get(key.name, "json");
    if (Array.isArray(stored)) {
      for (const token of stored) {
        if (typeof token === "string" && token.length > 20) tokens.add(token);
      }
    }
  }

  const results = await Promise.all(
    [...tokens].map(async (token) => {
      const androidNotification = {
        channel_id: "default",
        ...(notification.icon ? { icon: notification.icon } : {}),
        ...(notification.color ? { color: notification.color } : {}),
      };
      const response = await fetch(
        "https://fcm.googleapis.com/v1/projects/" + serviceAccount.project_id + "/messages:send",
        {
          method: "POST",
          headers: {
            authorization: "Bearer " + accessToken,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: notification.title, body: notification.body },
              data: { route: notification.route },
              android: {
                priority: "HIGH",
                notification: androidNotification,
              },
            },
          }),
        },
      );
      return response.ok;
    }),
  );

  return { sent: results.filter(Boolean).length, attempted: results.length };
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
      const user = await staff(request, env);
      if (!user) return json({ error: "STAFF_REQUIRED" }, 403);

      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "INVALID_JSON" }, 400);
      }

      const token =
        typeof payload.token === "string" ? payload.token.trim() : "";
      if (token.length < 20 || token.length > 4096) {
        return json({ error: "INVALID_TOKEN" }, 400);
      }

      const key = "admin:" + user.id;
      const previous = (await env.PUSH_TOKENS.get(key, "json")) || [];
      const next =
        url.pathname === "/register"
          ? [...new Set([...previous, token])].slice(-10)
          : previous.filter((item) => item !== token);

      if (next.length) {
        await env.PUSH_TOKENS.put(key, JSON.stringify(next));
      } else {
        await env.PUSH_TOKENS.delete(key);
      }

      return json({ registered: url.pathname === "/register", count: next.length });
    }

    if (url.pathname === "/notify") {
      if (
        !env.PUSH_WEBHOOK_SECRET ||
        request.headers.get("x-webhook-secret") !== env.PUSH_WEBHOOK_SECRET
      ) {
        return json({ error: "UNAUTHORIZED" }, 401);
      }

      try {
        const notification = notificationFromWebhook(await request.json());
        return notification ? json(await sendPush(env, notification)) : json({ ignored: true });
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "NOTIFICATION_FAILED" },
          500,
        );
      }
    }

    return json({ error: "NOT_FOUND" }, 404);
  },
};
