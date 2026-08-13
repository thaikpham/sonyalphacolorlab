-- Who is allowed into /admin.
--
-- A table rather than an `ADMIN_EMAILS` env var so adding an editor does not
-- need a redeploy. The cost is this migration; the benefit is that the list is
-- data, and the app already has a service-role path for reading data no
-- browser may see.

create table if not exists admin_emails (
  email text primary key,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table admin_emails enable row level security;

-- No policy, and no grant to anon or authenticated. That is the whole point:
-- this table is a list of personal email addresses, and RLS is row-level — it
-- cannot stop a `select email from admin_emails` once the role has the
-- privilege. `proposal_votes` is locked the same way and for the same reason.
--
-- Only the service-role client reads it, from `requireAdmin()`, which runs on
-- the server behind a verified JWT. A reader cannot enumerate the admins, and
-- cannot learn whether a given address is one.
revoke all on table admin_emails from anon, authenticated;

-- Seed the first admin so the UI is reachable at all. Everything else is added
-- through the table itself.
insert into admin_emails (email, note)
values ('thaikpham.art@gmail.com', 'project owner')
on conflict (email) do nothing;
