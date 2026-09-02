/**
 * Puppy Record API — Cloudflare Worker + D1.
 *
 * One record per dog. Each record has two bearer tokens:
 *   ownerToken — read + write. Keep private.
 *   viewToken  — read only. Safe to hand to a sitter, kennel or family member.
 *
 * Endpoints
 *   POST   /v1/records                 create a record, returns both tokens (once)
 *   GET    /v1/records/:id             read  (owner or view token)
 *   PUT    /v1/records/:id             write (owner token only)
 *   DELETE /v1/records/:id             delete (owner token only)
 *   GET    /v1/health                  liveness
 *
 * Concurrency: PUT is a compare-and-set on updatedAt. A stale write gets 409
 * plus the current server document so the client can merge rather than clobber.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_DOC_BYTES = 2 * 1024 * 1024;
const TOKEN_BYTES = 32;

/* ---------------------------------------------------------------- utils */

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extra },
  });
}

function err(status, code, message, extra = {}) {
  return json({ error: { code, message, ...extra } }, status);
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
  const origin = request.headers.get("Origin") || "";
  const allowOrigin =
    allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,If-Unmodified-Since",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function randomToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

/** Constant-time string compare — avoids leaking token bytes via timing. */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

/* ------------------------------------------------------------- handlers */

async function createRecord(request, env) {
  let body = {};
  try {
    if (request.headers.get("content-length") !== "0") body = await request.json();
  } catch {
    return err(400, "bad_json", "Body must be valid JSON.");
  }

  const doc = JSON.stringify(body.doc ?? {});
  if (doc.length > MAX_DOC_BYTES) {
    return err(413, "too_large", "Document exceeds the 2 MB limit.");
  }

  const id = newId();
  const ownerToken = randomToken();
  const viewToken = randomToken();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO records (id, owner_token, view_token, doc, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, ownerToken, viewToken, doc, now, now)
    .run();

  return json({ id, ownerToken, viewToken, updatedAt: now }, 201);
}

async function loadRecord(env, id) {
  return env.DB.prepare(
    `SELECT id, owner_token, view_token, doc, updated_at FROM records WHERE id = ?`
  )
    .bind(id)
    .first();
}

/** Returns "owner" | "view" | null. */
function authorise(row, token) {
  if (!token) return null;
  if (safeEqual(token, row.owner_token)) return "owner";
  if (safeEqual(token, row.view_token)) return "view";
  return null;
}

async function getRecord(request, env, id) {
  const row = await loadRecord(env, id);
  if (!row) return err(404, "not_found", "No record with that id.");

  const url = new URL(request.url);
  const token = bearer(request) || url.searchParams.get("token");
  const role = authorise(row, token);
  if (!role) return err(401, "unauthorised", "Missing or invalid token.");

  return json({
    id: row.id,
    role,
    updatedAt: row.updated_at,
    doc: JSON.parse(row.doc),
  });
}

async function putRecord(request, env, id) {
  const row = await loadRecord(env, id);
  if (!row) return err(404, "not_found", "No record with that id.");

  const role = authorise(row, bearer(request));
  if (role !== "owner") {
    return err(403, "read_only", "This token cannot write to the record.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "bad_json", "Body must be valid JSON.");
  }
  if (!body || typeof body.doc !== "object" || body.doc === null) {
    return err(400, "bad_request", "Expected { doc, baseUpdatedAt }.");
  }

  const doc = JSON.stringify(body.doc);
  if (doc.length > MAX_DOC_BYTES) {
    return err(413, "too_large", "Document exceeds the 2 MB limit.");
  }

  // Compare-and-set. A client that hasn't seen the newest server write is told so.
  const base = Number(body.baseUpdatedAt ?? 0);
  if (base && base < row.updated_at) {
    return err(409, "conflict", "The record changed on another device.", {
      updatedAt: row.updated_at,
      doc: JSON.parse(row.doc),
    });
  }

  const now = Date.now();
  const res = await env.DB.prepare(
    `UPDATE records SET doc = ?, updated_at = ? WHERE id = ? AND updated_at = ?`
  )
    .bind(doc, now, id, row.updated_at)
    .run();

  if (!res.meta.changes) {
    const fresh = await loadRecord(env, id);
    return err(409, "conflict", "The record changed while saving.", {
      updatedAt: fresh.updated_at,
      doc: JSON.parse(fresh.doc),
    });
  }

  return json({ id, updatedAt: now });
}

async function deleteRecord(request, env, id) {
  const row = await loadRecord(env, id);
  if (!row) return json({ deleted: true });
  if (authorise(row, bearer(request)) !== "owner") {
    return err(403, "read_only", "This token cannot delete the record.");
  }
  await env.DB.prepare(`DELETE FROM records WHERE id = ?`).bind(id).run();
  return json({ deleted: true });
}

/* --------------------------------------------------------------- router */

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    let response;
    try {
      const url = new URL(request.url);
      const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);

      if (parts[0] !== "v1") {
        response = err(404, "not_found", "Unknown path.");
      } else if (parts[1] === "health" && parts.length === 2) {
        response = json({ ok: true, time: Date.now() });
      } else if (parts[1] === "records" && parts.length === 2) {
        response =
          request.method === "POST"
            ? await createRecord(request, env)
            : err(405, "method_not_allowed", "Use POST to create a record.");
      } else if (parts[1] === "records" && parts.length === 3) {
        const id = parts[2];
        if (!/^[a-f0-9]{20}$/.test(id)) {
          response = err(400, "bad_id", "Malformed record id.");
        } else if (request.method === "GET") {
          response = await getRecord(request, env, id);
        } else if (request.method === "PUT") {
          response = await putRecord(request, env, id);
        } else if (request.method === "DELETE") {
          response = await deleteRecord(request, env, id);
        } else {
          response = err(405, "method_not_allowed", "Unsupported method.");
        }
      } else {
        response = err(404, "not_found", "Unknown path.");
      }
    } catch (e) {
      console.error("unhandled", e && e.stack ? e.stack : e);
      response = err(500, "server_error", "Something went wrong.");
    }

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },
};
