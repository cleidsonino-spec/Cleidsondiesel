import { corsHeaders, json, sendToAdmins } from "../_shared/push.ts";

const messages = (table: string, event: string, record: Record<string, unknown>, old: Record<string, unknown>) => {
  if (table === "appointments" && event === "INSERT") {
    return { title: "Novo agendamento", body: `${record.customer_name ?? "Cliente"} solicitou um horário.`, route: "/painel/agendamentos" };
  }
  if (table === "service_orders" && event === "INSERT") {
    return { title: "Nova ordem de serviço", body: `OS #${record.number ?? ""} cadastrada.`, route: `/painel/ordens/${record.id}` };
  }
  if (table === "service_orders" && event === "UPDATE" && old.status !== "pronto" && record.status === "pronto") {
    return { title: "Serviço pronto", body: `OS #${record.number ?? ""} está pronta para retirada.`, route: `/painel/ordens/${record.id}` };
  }
  if (table === "warranties" && event === "INSERT") {
    return { title: "Garantia emitida", body: "Uma nova garantia foi registrada.", route: "/painel/garantias" };
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "UNAUTHORIZED" }, 401);
  try {
    const payload = await req.json();
    const table = String(payload.table ?? "");
    const event = String(payload.type ?? "").toUpperCase();
    const record = (payload.record ?? {}) as Record<string, unknown>;
    const old = (payload.old_record ?? {}) as Record<string, unknown>;
    const message = messages(table, event, record, old);
    if (!message) return json({ ignored: true });
    return json(await sendToAdmins(message.title, message.body, message.route));
  } catch {
    return json({ error: "NOTIFICATION_FAILED" }, 500);
  }
});
