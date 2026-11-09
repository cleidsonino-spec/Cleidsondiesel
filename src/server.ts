import "./lib/error-capture";

import { neon } from "@neondatabase/serverless";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type WorkerEnv = {
  DATABASE_URL?: string;
};

type ServerEntry = {
  fetch: (request: Request, env: WorkerEnv, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function jsonResponse(body: { ok: boolean; error?: string }, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// This endpoint reports only connectivity status. It never returns credentials or database errors.
async function handleDatabaseHealth(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!env.DATABASE_URL) {
    return jsonResponse({ ok: false, error: "database_not_configured" }, 503);
  }

  try {
    const sql = neon(env.DATABASE_URL);
    const rows = await sql`select 1 as ok`;
    if (Number(rows[0]?.ok) !== 1) {
      return jsonResponse({ ok: false, error: "database_check_failed" }, 503);
    }
    return jsonResponse({ ok: true }, 200);
  } catch {
    // Do not log the driver error: some database errors may contain connection details.
    return jsonResponse({ ok: false, error: "database_unavailable" }, 503);
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/_internal/health/database") {
        return await handleDatabaseHealth(request, env);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch {
      // Avoid logging request/runtime objects that could contain secrets.
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
