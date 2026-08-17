-- One row, one shared scope, for the App scope and options board.
--
-- Run this once against your Supabase project (SQL editor, or psql against the
-- pooler connection string). Safe to re-run: it will not clobber an existing
-- row or an existing table.
--
-- The version column is the concurrency mechanism. /api/scope only updates
-- where version matches what the client loaded, so a save built on a stale
-- read fails loudly instead of overwriting someone else's work.

create table if not exists public.app_scope (
  id          text        primary key,
  buckets     jsonb       not null,
  version     integer     not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- RLS on with no policies, on purpose. Only the service-role key bypasses RLS,
-- and that key is used exclusively by /api/scope on the server. The anon and
-- authenticated roles get nothing, so the table is unreachable from the browser.
alter table public.app_scope enable row level security;

-- Seed the live scope with the board's defaults: 30 in MVP, 26 in future phases.
-- Any feature id missing from this map falls back to its default in the page,
-- so adding features to the board later does not require a migration.
insert into public.app_scope (id, buckets, version, updated_by)
values (
  'default',
  '{
      "plat": "mvp",
      "ident": "mvp",
      "kprof": "mvp",
      "kev": "mvp",
      "signin": "mvp",
      "signup": "mvp",
      "profile": "mvp",
      "pause": "mvp",
      "skip": "mvp",
      "delay": "mvp",
      "freq": "mvp",
      "swap": "mvp",
      "addprod": "mvp",
      "cancel": "mvp",
      "payaddr": "mvp",
      "browse": "mvp",
      "pdp": "mvp",
      "plp": "mvp",
      "selling": "mvp",
      "checkout": "mvp",
      "orders": "mvp",
      "push": "mvp",
      "notifmgmt": "mvp",
      "optin": "mvp",
      "deeplink": "mvp",
      "care": "mvp",
      "funnel": "mvp",
      "cohort": "mvp",
      "pushoptin": "mvp",
      "retcompare": "mvp",
      "richpush": "future",
      "deferred": "future",
      "iam": "future",
      "iamtarget": "future",
      "iamtrig": "future",
      "upsell": "future",
      "dynperso": "future",
      "profperso": "future",
      "rewards": "future",
      "gift": "future",
      "referral": "future",
      "routine": "future",
      "dosing": "future",
      "paced": "future",
      "subviz": "future",
      "subhome": "future",
      "bundle": "future",
      "checklist": "future",
      "reviews": "future",
      "quiz": "future",
      "socials": "future",
      "engage": "future",
      "wishlist": "future",
      "live": "future",
      "content": "future",
      "multicur": "future"
    }'::jsonb,
  1,
  null
)
on conflict (id) do nothing;
