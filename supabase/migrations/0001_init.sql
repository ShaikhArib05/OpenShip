-- OpenShip initial schema. Run in the Supabase SQL editor or via `supabase db push`.
create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type workspace_role as enum ('owner', 'member');
create type task_status as enum ('todo', 'in_progress', 'in_review', 'done');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type sprint_status as enum ('planned', 'active', 'completed');

-- ---------- tables ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on workspace_members (user_id);

create table workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_by uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on workspace_invites (workspace_id);

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  archived boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create index on projects (workspace_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  assignee_id uuid references profiles(id) on delete set null,
  creator_id uuid not null references profiles(id),
  due_date date,
  labels text[] not null default '{}',
  estimate int check (estimate is null or estimate >= 0), -- story points
  position double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on tasks (project_id, status);
create index on tasks (assignee_id);
create index on tasks (due_date);

create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index on comments (task_id);

create table sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  goal text,
  start_date date not null,
  end_date date not null,
  status sprint_status not null default 'planned',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on sprints (project_id);
-- at most one active sprint per project
create unique index one_active_sprint on sprints (project_id) where status = 'active';

create table sprint_tasks (
  sprint_id uuid not null references sprints(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (sprint_id, task_id)
);
create index on sprint_tasks (task_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('assignment', 'mention', 'status_change')),
  message text not null,
  task_id uuid references tasks(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read, created_at desc);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on activity_logs (project_id, created_at desc);
create index on activity_logs (task_id, created_at desc);

-- ---------- helpers (security definer avoids RLS recursion) ----------
create function is_workspace_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;

create function is_workspace_owner(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = 'owner');
$$;

create function can_access_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p
    join workspace_members m on m.workspace_id = p.workspace_id
    where p.id = pid and m.user_id = auth.uid());
$$;

create function can_access_task(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tasks t where t.id = tid and can_access_project(t.project_id));
$$;

-- ---------- triggers ----------
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- creator of a workspace becomes its owner member
create function add_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into workspace_members (workspace_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger on_workspace_created after insert on workspaces
  for each row execute function add_owner_member();

create function touch_task() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status <> 'done' then new.completed_at = now();
  elsif new.status <> 'done' then new.completed_at = null; end if;
  return new;
end $$;
create trigger tasks_touch before update on tasks for each row execute function touch_task();

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table sprints enable row level security;
alter table sprint_tasks enable row level security;
alter table notifications enable row level security;
alter table activity_logs enable row level security;

-- profiles: self, or anyone sharing a workspace
create policy profiles_select on profiles for select using (
  id = auth.uid() or exists (
    select 1 from workspace_members a join workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- workspaces
create policy ws_select on workspaces for select using (is_workspace_member(id));
create policy ws_insert on workspaces for insert with check (owner_id = auth.uid());
create policy ws_update on workspaces for update using (is_workspace_owner(id));
create policy ws_delete on workspaces for delete using (is_workspace_owner(id));

-- members: visible to members; only owners add/remove (joining happens via backend invite acceptance)
create policy wm_select on workspace_members for select using (is_workspace_member(workspace_id));
create policy wm_delete on workspace_members for delete using (
  is_workspace_owner(workspace_id) or user_id = auth.uid());

-- invites: owners only
create policy inv_all on workspace_invites for all
  using (is_workspace_owner(workspace_id)) with check (is_workspace_owner(workspace_id));

-- projects: members read/write; owners delete
create policy proj_select on projects for select using (is_workspace_member(workspace_id));
create policy proj_insert on projects for insert with check (is_workspace_member(workspace_id) and created_by = auth.uid());
create policy proj_update on projects for update using (is_workspace_member(workspace_id));
create policy proj_delete on projects for delete using (is_workspace_owner(workspace_id));

-- tasks / sprints / comments / logs: scoped through project
create policy task_select on tasks for select using (can_access_project(project_id));
create policy task_insert on tasks for insert with check (can_access_project(project_id) and creator_id = auth.uid());
create policy task_update on tasks for update using (can_access_project(project_id));
create policy task_delete on tasks for delete using (can_access_project(project_id));

create policy sprint_select on sprints for select using (can_access_project(project_id));
create policy sprint_write on sprints for all
  using (can_access_project(project_id)) with check (can_access_project(project_id));

create policy st_select on sprint_tasks for select using (can_access_task(task_id));
create policy st_write on sprint_tasks for all
  using (can_access_task(task_id)) with check (can_access_task(task_id));

create policy comment_select on comments for select using (can_access_task(task_id));
create policy comment_insert on comments for insert with check (can_access_task(task_id) and author_id = auth.uid());
create policy comment_modify on comments for update using (author_id = auth.uid());
create policy comment_delete on comments for delete using (author_id = auth.uid());

create policy log_select on activity_logs for select using (can_access_project(project_id));
create policy log_insert on activity_logs for insert with check (can_access_project(project_id) and actor_id = auth.uid());

-- notifications: own only (inserted by backend with service role)
create policy notif_select on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on notifications for delete using (user_id = auth.uid());
