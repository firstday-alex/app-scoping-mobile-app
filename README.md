# App scope and options board

Drag-and-drop MVP scope board, platform gate table and weighted option matrix for
the First Day mobile app decision. One shared scope, edited by everyone.

```
public/index.html          the board (no build step, no framework)
api/scope.js               GET/PUT the shared scope, Vercel serverless function
supabase/001_app_scope.sql the one-time migration
```

## Setup

**1. Run the migration.** Open the Supabase SQL editor and run
`supabase/001_app_scope.sql`. It creates `public.app_scope`, turns RLS on, and
seeds the row with the board's defaults (30 features in MVP, 26 in future
phases). Safe to re-run — it won't clobber an existing row.

**2. Set two environment variables** in the Vercel project, from
Supabase → Project Settings → API:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key |

**3. Deploy.** `vercel --prod` from this directory. Zero config: `public/` is
served static, `api/scope.js` becomes a function, nothing is installed or built.

Locally, `vercel dev` with a `.env.local` (see `.env.example`).

## How saving works

Everyone edits one row. Each save carries the `version` it was based on, and the
update only applies where that version still matches. So the second of two
concurrent saves fails with a 409 rather than silently overwriting the first —
the loser gets a banner naming who saved and offering **Load their version** or
**Overwrite with mine**. The board also polls every 30 seconds and on tab focus:
if it's clean it adopts the newer version silently, if it has unsaved edits it
warns instead of discarding them.

There's no login. The "Editing as" field is a name for attribution only, kept in
localStorage. Anyone with the URL can edit — put it behind Vercel password
protection or an access group if that matters.

## Degrading

The board never blocks on the backend. If `/api/scope` is unreachable,
unconfigured (503) or unseeded (404), it falls back to localStorage and the
status line says so — `Saved in this browser only`, or `Preview mode` where
localStorage itself is blocked, as it is inside Claude's preview sandbox.
Download JSON and Copy JSON work in every mode.

## Security notes

- The service-role key is read server-side in `api/scope.js` only. It bypasses
  RLS, so it must never be given a client-visible prefix or inlined in the page.
- `app_scope` has RLS enabled with **no policies**, so `anon` and
  `authenticated` can't reach it at all. Access is only through `/api/scope`.
- The route validates the payload before writing: object shape, ≤200 keys,
  ids matching `[a-z0-9_-]{1,40}`, values in `{mvp, future}`.

## Changing the feature list

Edit the `FEATURES` array in `public/index.html`. No migration needed — feature
ids missing from the stored row fall back to their default bucket in the page,
and ids in the row that no longer exist in the page are ignored.
# app-scoping-mobile-app
