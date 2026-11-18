-- Append-only administrative audit trail for privileged moderation actions.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('moderate_post', 'delete_post')),
  target_type text not null check (target_type = 'post'),
  target_id uuid not null,
  status text not null default 'started'
    check (status in ('started', 'succeeded', 'failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_actor_created_idx
  on public.admin_audit_logs (actor_id, created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from anon, authenticated;
grant select, insert, update on table public.admin_audit_logs to service_role;

comment on table public.admin_audit_logs is
  'Server-written audit trail for privileged admin-console moderation actions. Not readable by client roles.';
