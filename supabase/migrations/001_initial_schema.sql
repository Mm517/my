create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Student',
  username text unique,
  phone text,
  avatar_url text,
  bio text,
  grade text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_banned boolean not null default false,
  is_muted boolean not null default false,
  messages_sent integer not null default 0 check (messages_sent >= 0),
  joined_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index profiles_username_idx on public.profiles (username);
create index profiles_display_name_idx on public.profiles (display_name);
create index profiles_last_seen_idx on public.profiles (last_seen_at);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and not is_banned
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'student'), '@', 1)
    ),
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);
create index groups_created_by_idx on public.groups (created_by);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  content text not null default '',
  attachment jsonb,
  poll jsonb,
  parent_id uuid references public.messages(id) on delete set null,
  is_pinned boolean not null default false,
  edited boolean not null default false,
  filtered boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint messages_has_content_or_payload check (
    length(trim(content)) > 0 or attachment is not null or poll is not null
  )
);

create index messages_created_idx on public.messages (created_at desc);
create index messages_user_idx on public.messages (user_id, created_at desc);
create index messages_group_idx on public.messages (group_id, created_at desc);
create index messages_parent_idx on public.messages (parent_id);
create index messages_pinned_idx on public.messages (is_pinned) where is_pinned;
create index messages_search_idx on public.messages using gin (to_tsvector('simple', content));

create table public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  seen_at timestamptz,
  primary key (message_id, user_id)
);

create index message_receipts_user_idx on public.message_receipts (user_id);
create index message_receipts_delivered_idx on public.message_receipts (message_id, delivered_at);
create index message_receipts_seen_idx on public.message_receipts (message_id, seen_at);

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, user_id, emoji)
);

create index message_reactions_message_idx on public.message_reactions (message_id);
create index message_reactions_user_idx on public.message_reactions (user_id);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, user_id, option_id)
);

create index poll_votes_message_idx on public.poll_votes (message_id);
create index poll_votes_user_idx on public.poll_votes (user_id);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text,
  details text not null,
  target_date timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index study_plans_user_idx on public.study_plans (user_id, created_at desc);
create index study_plans_target_date_idx on public.study_plans (target_date);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  details text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index challenges_user_idx on public.challenges (user_id, created_at desc);
create index challenges_completed_idx on public.challenges (user_id, completed);

create table public.chat_settings (
  id smallint primary key default 1 check (id = 1),
  chat_enabled boolean not null default true,
  announcement text,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.chat_settings (id)
values (1)
on conflict (id) do nothing;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_user_idx on public.activity_logs (user_id, created_at desc);
create index activity_logs_action_idx on public.activity_logs (action, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  message_id uuid references public.messages(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create or replace view public.profiles_public as
select id, display_name, username, avatar_url, bio, grade, role, created_at, updated_at
from public.profiles;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger groups_updated_at
  before update on public.groups
  for each row execute procedure public.set_updated_at();

create trigger messages_updated_at
  before update on public.messages
  for each row execute procedure public.set_updated_at();

create trigger study_plans_updated_at
  before update on public.study_plans
  for each row execute procedure public.set_updated_at();

create trigger challenges_updated_at
  before update on public.challenges
  for each row execute procedure public.set_updated_at();

create trigger chat_settings_updated_at
  before update on public.chat_settings
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.message_reactions enable row level security;
alter table public.poll_votes enable row level security;
alter table public.study_plans enable row level security;
alter table public.challenges enable row level security;
alter table public.chat_settings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

create policy profiles_self_or_admin_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_self_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_self_or_admin_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy groups_authenticated_select on public.groups
  for select to authenticated using (true);

create policy groups_authenticated_insert on public.groups
  for insert to authenticated with check (created_by = auth.uid());

create policy groups_owner_or_admin_update on public.groups
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy group_members_authenticated_select on public.group_members
  for select to authenticated using (true);

create policy group_members_self_insert on public.group_members
  for insert to authenticated with check (user_id = auth.uid() or public.is_admin());

create policy group_members_self_delete on public.group_members
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy messages_authenticated_select on public.messages
  for select to authenticated using (not deleted or user_id = auth.uid() or public.is_admin());

create policy messages_self_insert on public.messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and not is_banned
    )
  );

create policy messages_owner_or_admin_update on public.messages
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy messages_owner_or_admin_delete on public.messages
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy receipts_message_participant_select on public.message_receipts
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.messages m
      where m.id = message_id and m.user_id = auth.uid()
    )
    or public.is_admin()
  );

create policy receipts_self_insert on public.message_receipts
  for insert to authenticated with check (user_id = auth.uid());

create policy receipts_self_update on public.message_receipts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy reactions_authenticated_select on public.message_reactions
  for select to authenticated using (true);

create policy reactions_self_insert on public.message_reactions
  for insert to authenticated with check (user_id = auth.uid());

create policy reactions_self_delete on public.message_reactions
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy poll_votes_authenticated_select on public.poll_votes
  for select to authenticated using (true);

create policy poll_votes_self_insert on public.poll_votes
  for insert to authenticated with check (user_id = auth.uid());

create policy poll_votes_self_delete on public.poll_votes
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy study_plans_owner_or_admin on public.study_plans
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy challenges_owner_or_admin on public.challenges
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy chat_settings_authenticated_select on public.chat_settings
  for select to authenticated using (true);

create policy chat_settings_admin_update on public.chat_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy activity_logs_self_or_admin_select on public.activity_logs
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy activity_logs_authenticated_insert on public.activity_logs
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy push_subscriptions_owner on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy notifications_recipient on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid() or public.is_admin());

create policy notifications_recipient_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid() or public.is_admin())
  with check (recipient_id = auth.uid() or public.is_admin());

create policy notifications_service_insert on public.notifications
  for insert to authenticated
  with check (actor_id = auth.uid() or public.is_admin());

grant select on public.profiles_public to authenticated;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do update set public = excluded.public;

create policy chat_attachments_insert_own_folder
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy chat_attachments_select_own_or_admin
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy chat_attachments_update_own_or_admin
  on storage.objects for update to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  )
  with check (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy chat_attachments_delete_own_or_admin
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'groups',
    'group_members',
    'messages',
    'message_receipts',
    'message_reactions',
    'poll_votes',
    'chat_settings',
    'notifications'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;