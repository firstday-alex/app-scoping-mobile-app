/**
 * Shared scope state for the app scoping board.
 *
 * One row, one live scope. Concurrency is optimistic: every save carries the
 * version it was based on, and a save built on a stale version is rejected with
 * 409 rather than silently overwriting whoever got there first.
 *
 * Talks to Supabase over PostgREST with plain fetch, so there are no
 * dependencies and no build step. The service-role key stays server-side; the
 * table has RLS on with no policies, so nothing reaches it except this route.
 */

const URL_BASE = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROW_ID = process.env.SCOPE_ROW_ID || "default";
const TABLE = "app_scope";
const SELECT = "select=buckets,version,updated_at,updated_by";

const VALID_BUCKETS = new Set(["mvp", "future"]);
const MAX_FEATURES = 200;

function rest(path, init = {}) {
  return fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
}

async function readRow() {
  const r = await rest(`${TABLE}?id=eq.${encodeURIComponent(ROW_ID)}&${SELECT}`);
  if (!r.ok) throw new Error(`supabase read ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0] || null;
}

/* Returns a reason string when the payload is unusable, null when it's fine. */
function invalidReason(buckets) {
  if (!buckets || typeof buckets !== "object" || Array.isArray(buckets)) {
    return "buckets must be an object";
  }
  const ids = Object.keys(buckets);
  if (!ids.length) return "buckets is empty";
  if (ids.length > MAX_FEATURES) return `too many features (${ids.length})`;
  for (const id of ids) {
    if (!/^[a-z0-9_-]{1,40}$/i.test(id)) return `bad feature id: ${id}`;
    if (!VALID_BUCKETS.has(buckets[id])) return `bad bucket for ${id}: ${buckets[id]}`;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!URL_BASE || !SERVICE_KEY) {
    return res.status(503).json({
      error: "unconfigured",
      detail:
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set — the board falls back to per-browser storage."
    });
  }

  try {
    if (req.method === "GET") {
      const row = await readRow();
      if (!row) {
        return res.status(404).json({
          error: "no_row",
          detail: `No '${ROW_ID}' row in ${TABLE} — run supabase/001_app_scope.sql.`
        });
      }
      return res.status(200).json(row);
    }

    if (req.method === "PUT") {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { buckets, version, updatedBy } = body;

      const bad = invalidReason(buckets);
      if (bad) return res.status(400).json({ error: "invalid", detail: bad });
      if (!Number.isInteger(version)) {
        return res.status(400).json({ error: "invalid", detail: "version must be an integer" });
      }

      const who =
        typeof updatedBy === "string" && updatedBy.trim()
          ? updatedBy.trim().slice(0, 60)
          : null;

      /* The version filter is the whole concurrency story: PostgREST updates
         nothing if someone else has already bumped it. */
      const r = await rest(
        `${TABLE}?id=eq.${encodeURIComponent(ROW_ID)}&version=eq.${version}&${SELECT}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            buckets,
            version: version + 1,
            updated_at: new Date().toISOString(),
            updated_by: who
          })
        }
      );
      if (!r.ok) throw new Error(`supabase write ${r.status}: ${await r.text()}`);
      const rows = await r.json();

      if (!rows.length) {
        /* Either the row is gone, or someone saved first. Send back what is
           actually there so the client can show the difference. */
        const current = await readRow();
        if (!current) return res.status(404).json({ error: "no_row" });
        return res.status(409).json({ error: "stale", current });
      }
      return res.status(200).json(rows[0]);
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    return res.status(502).json({ error: "upstream", detail: String(err.message || err) });
  }
}
