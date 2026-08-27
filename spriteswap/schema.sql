-- SpriteSwap community database schema for Supabase
-- Run this whole file in Supabase > SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 24),
  bio text not null default '' check (char_length(bio) <= 240),
  epic_name text not null default '' check (char_length(epic_name) <= 40),
  avatar_url text not null default '',
  rating_count integer not null default 0,
  rating_avg numeric(3,2) not null default 0,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  offer text not null check (char_length(offer) between 1 and 60),
  want text not null check (char_length(want) between 1 and 60),
  offer_items text[] not null default '{}'::text[] check (cardinality(offer_items) <= 8),
  want_items text[] not null default '{}'::text[] check (cardinality(want_items) <= 8),
  tier text not null check (tier in ('Base','Gold','Cheat Master','Any')),
  note text not null default '' check (char_length(note) <= 240),
  status text not null default 'open' check (status in ('open','closed','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references public.profiles(id) on delete cascade,
  rated_id uuid not null references public.profiles(id) on delete cascade,
  trade_id uuid references public.trades(id) on delete set null,
  stars integer not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 160),
  created_at timestamptz not null default now(),
  unique(rater_id, rated_id),
  check (rater_id <> rated_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  trade_id uuid references public.trades(id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  trade_id uuid references public.trades(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 80),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(nullif(regexp_replace(new.raw_user_meta_data->>'username', '[^A-Za-z0-9_]', '', 'g'), ''), 'collector_' || left(new.id::text, 8))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.refresh_profile_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare target uuid;
begin
  target := coalesce(new.rated_id, old.rated_id);
  update public.profiles p
     set rating_count = x.cnt,
         rating_avg = x.avg_stars
    from (
      select count(*)::int cnt, coalesce(round(avg(stars)::numeric, 2),0) avg_stars
      from public.ratings where rated_id = target
    ) x
   where p.id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists ratings_refresh_profile on public.ratings;
create trigger ratings_refresh_profile
after insert or update or delete on public.ratings
for each row execute function public.refresh_profile_rating();

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = uid), false); $$;

-- Protect moderation/system-managed profile fields from normal users.
-- RLS controls which rows can be updated; this trigger controls which columns.
create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    if new.id is distinct from old.id
       or new.rating_count is distinct from old.rating_count
       or new.rating_avg is distinct from old.rating_avg
       or new.is_admin is distinct from old.is_admin
       or new.is_banned is distinct from old.is_banned
       or new.created_at is distinct from old.created_at then
      raise exception 'You cannot change protected profile fields.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_system_fields on public.profiles;
create trigger protect_profile_system_fields
before update on public.profiles
for each row execute function public.protect_profile_system_fields();

alter table public.profiles enable row level security;
alter table public.trades enable row level security;
alter table public.ratings enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

-- Profiles: public read, own update; admins can moderate.
drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Trades: anyone can read non-removed; signed-in non-banned users can create; owners manage theirs; admins manage all.
drop policy if exists "trades public read" on public.trades;
create policy "trades public read" on public.trades for select using (status <> 'removed' or public.is_admin(auth.uid()));
drop policy if exists "trades create" on public.trades;
create policy "trades create" on public.trades for insert with check (
  auth.uid() = user_id and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
);
drop policy if exists "trades owner update" on public.trades;
create policy "trades owner update" on public.trades for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "trades owner delete" on public.trades;
create policy "trades owner delete" on public.trades for delete using (auth.uid() = user_id);
drop policy if exists "trades admin update" on public.trades;
create policy "trades admin update" on public.trades for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Ratings: public read; users can create/edit/delete their own ratings.
drop policy if exists "ratings public read" on public.ratings;
create policy "ratings public read" on public.ratings for select using (true);
drop policy if exists "ratings create" on public.ratings;
create policy "ratings create" on public.ratings for insert with check (
  auth.uid() = rater_id
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
  and rated_id <> auth.uid()
);
drop policy if exists "ratings own update" on public.ratings;
create policy "ratings own update" on public.ratings for update
using (auth.uid() = rater_id)
with check (
  auth.uid() = rater_id
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
  and rated_id <> auth.uid()
);
drop policy if exists "ratings own delete" on public.ratings;
create policy "ratings own delete" on public.ratings for delete using (auth.uid() = rater_id);

-- Messages: only sender and recipient can read. Sender creates. Recipient can mark read.
drop policy if exists "messages participant read" on public.messages;
create policy "messages participant read" on public.messages for select using (auth.uid() in (sender_id, recipient_id));
drop policy if exists "messages sender create" on public.messages;
create policy "messages sender create" on public.messages for insert with check (
  auth.uid() = sender_id
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
);
drop policy if exists "messages recipient update" on public.messages;
create policy "messages recipient update" on public.messages for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- Reports: reporters see their own; admins see/manage all.
drop policy if exists "reports own read" on public.reports;
create policy "reports own read" on public.reports for select using (auth.uid() = reporter_id or public.is_admin(auth.uid()));
drop policy if exists "reports create" on public.reports;
create policy "reports create" on public.reports for insert with check (
  auth.uid() = reporter_id
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
);
drop policy if exists "reports admin update" on public.reports;
create policy "reports admin update" on public.reports for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));


-- V19 multi-Sprite trade migration. Safe to run on an existing SpriteSwap database.
alter table public.trades add column if not exists offer_items text[] not null default '{}'::text[];
alter table public.trades add column if not exists want_items text[] not null default '{}'::text[];
do $$ begin
  alter table public.trades add constraint trades_offer_items_max check (cardinality(offer_items) <= 8);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trades add constraint trades_want_items_max check (cardinality(want_items) <= 8);
exception when duplicate_object then null; end $$;
create index if not exists trades_offer_items_gin on public.trades using gin (offer_items);
create index if not exists trades_want_items_gin on public.trades using gin (want_items);

-- Backfill older single-Sprite listings so every part of the app can use the same shape.
update public.trades set offer_items = array[offer] where cardinality(offer_items)=0;
update public.trades set want_items = array[want] where cardinality(want_items)=0;

-- Realtime for trades + messages (safe to ignore duplicate-publication errors if re-running manually)
do $$ begin
  alter publication supabase_realtime add table public.trades;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

create index if not exists trades_created_idx on public.trades(created_at desc);
create index if not exists trades_user_idx on public.trades(user_id);
create index if not exists messages_pair_idx on public.messages(sender_id, recipient_id, created_at);
create index if not exists reports_status_idx on public.reports(status, created_at desc);


-- ============================================================
-- Sprite Vault public inventories + Epic account linking
-- Safe to append/re-run after the original SpriteSwap schema.
-- ============================================================

create table if not exists public.sprite_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sprite_id text not null check (char_length(sprite_id) between 1 and 120),
  owned boolean not null default true,
  mastered boolean not null default false,
  rarity text not null default 'rare' check (rarity in ('rare','epic','legendary','mythic','special')),
  updated_at timestamptz not null default now(),
  primary key (user_id, sprite_id),
  check (not mastered or owned)
);

create table if not exists public.epic_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  epic_account_id text unique not null,
  epic_display_name text not null default '',
  linked_at timestamptz not null default now()
);

alter table public.sprite_inventory enable row level security;
alter table public.epic_links enable row level security;

-- Inventories are intentionally public: SpriteSwap profiles are collection showcases.
drop policy if exists "inventory public read" on public.sprite_inventory;
create policy "inventory public read" on public.sprite_inventory for select using (true);
drop policy if exists "inventory own insert" on public.sprite_inventory;
create policy "inventory own insert" on public.sprite_inventory for insert with check (
  auth.uid() = user_id and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
);
drop policy if exists "inventory own update" on public.sprite_inventory;
create policy "inventory own update" on public.sprite_inventory for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id and not coalesce((select is_banned from public.profiles where id = auth.uid()), true));
drop policy if exists "inventory own delete" on public.sprite_inventory;
create policy "inventory own delete" on public.sprite_inventory for delete using (auth.uid() = user_id);

-- Epic account IDs are private. The Vercel callback uses the Supabase service role.
drop policy if exists "epic link own read" on public.epic_links;
create policy "epic link own read" on public.epic_links for select using (auth.uid() = user_id);

-- Let the server-side Epic callback update the public Epic display name without
-- exposing the Epic account id in profiles.
create or replace function public.set_epic_display_name(target_user uuid, display_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set epic_name = left(coalesce(display_name,''),40) where id = target_user;
end;
$$;
revoke all on function public.set_epic_display_name(uuid,text) from public, anon, authenticated;
grant execute on function public.set_epic_display_name(uuid,text) to service_role;

-- Realtime collection changes make profile flex stats update quickly.
do $$
begin
  alter publication supabase_realtime add table public.sprite_inventory;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Discord sign-in migration (V9)
-- Safe to run after the existing SpriteSwap schema.
-- ============================================================

alter table public.profiles add column if not exists discord_name text not null default '';
alter table public.profiles drop constraint if exists profiles_discord_name_check;
alter table public.profiles add constraint profiles_discord_name_check check (char_length(discord_name) <= 40);

create table if not exists public.discord_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  discord_user_id text unique not null,
  discord_username text not null default '',
  discord_display_name text not null default '',
  avatar_url text not null default '',
  linked_at timestamptz not null default now()
);

alter table public.discord_links enable row level security;
drop policy if exists "discord link own read" on public.discord_links;
create policy "discord link own read" on public.discord_links for select using (auth.uid() = user_id);

create or replace function public.set_discord_identity(target_user uuid, display_name text, avatar text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
     set discord_name = left(coalesce(display_name,''),40),
         avatar_url = left(coalesce(avatar,''),500)
   where id = target_user;
end;
$$;
revoke all on function public.set_discord_identity(uuid,text,text) from public, anon, authenticated;
grant execute on function public.set_discord_identity(uuid,text,text) to service_role;

-- Protect provider-managed identity fields from normal profile edits.
create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Server-side OAuth callbacks use the Supabase service role. Allow those
  -- trusted writes so Discord display name/avatar can stay synced.
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_admin(auth.uid()) then
    if new.id is distinct from old.id
       or new.rating_count is distinct from old.rating_count
       or new.rating_avg is distinct from old.rating_avg
       or new.is_admin is distinct from old.is_admin
       or new.is_banned is distinct from old.is_banned
       or new.created_at is distinct from old.created_at
       or new.discord_name is distinct from old.discord_name
       or new.avatar_url is distinct from old.avatar_url then
      raise exception 'You cannot change protected profile fields.';
    end if;
  end if;
  return new;
end;
$$;

-- V12 identity sync updates username + Discord display name + avatar atomically.
create or replace function public.set_discord_identity(target_user uuid, account_username text, display_name text, avatar text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
     set username = left(coalesce(nullif(account_username,''),'discord_user'),24),
         discord_name = left(coalesce(display_name,''),40),
         avatar_url = left(coalesce(avatar,''),500)
   where id = target_user;
end;
$$;
revoke all on function public.set_discord_identity(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.set_discord_identity(uuid,text,text,text) to service_role;

-- ============================================================
-- V16: live Sprite catalog sourced from Fortnite.GG
-- Static V15 catalog stays as the baseline; only newly discovered
-- Sprite names/variants are stored here and merged into the site.
-- ============================================================
create table if not exists public.sprite_catalog (
  id text primary key,
  source_url text unique not null,
  name text not null,
  base text not null,
  variant text not null default 'Base',
  rarity text not null default 'rare',
  chance text not null default '0%',
  season text not null default 'Latest',
  image text not null,
  unreleased boolean not null default false,
  source text not null default 'fortnite.gg',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.sprite_sync_state (
  id text primary key,
  last_synced_at timestamptz,
  last_found_count integer not null default 0,
  last_new_count integer not null default 0
);

alter table public.sprite_catalog enable row level security;
alter table public.sprite_sync_state enable row level security;

drop policy if exists "sprite catalog public read" on public.sprite_catalog;
create policy "sprite catalog public read"
on public.sprite_catalog for select
using (true);

create index if not exists sprite_catalog_name_idx on public.sprite_catalog (lower(name));
create index if not exists sprite_catalog_first_seen_idx on public.sprite_catalog (first_seen_at desc);


-- ============================================================
-- V22: accepted trade requests unlock chat
-- ============================================================

-- Accepted trades leave the public open board while the two traders coordinate.
alter table public.trades drop constraint if exists trades_status_check;
alter table public.trades
  add constraint trades_status_check
  check (status in ('open','active','closed','removed'));

create table if not exists public.trade_requests (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','completed')),
  requester_completed boolean not null default false,
  owner_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (trade_id, requester_id),
  check (requester_id <> owner_id)
);

create index if not exists trade_requests_trade_idx on public.trade_requests(trade_id);
create index if not exists trade_requests_requester_idx on public.trade_requests(requester_id, status);
create index if not exists trade_requests_owner_idx on public.trade_requests(owner_id, status);

alter table public.trade_requests enable row level security;

drop policy if exists "trade requests participants read" on public.trade_requests;
create policy "trade requests participants read"
on public.trade_requests for select
using (
  auth.uid() in (requester_id, owner_id)
  or public.is_admin(auth.uid())
);

-- Requests are created through request_trade(), which validates the listing and
-- can safely re-open a previously declined/cancelled request.
drop policy if exists "trade requests direct insert" on public.trade_requests;
drop policy if exists "trade requests direct update" on public.trade_requests;
drop policy if exists "trade requests direct delete" on public.trade_requests;

create or replace function public.request_trade(p_trade_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner_uid uuid;
  current_status text;
  req_id uuid;
begin
  if uid is null then
    raise exception 'Sign in to request this trade.';
  end if;

  if coalesce((select is_banned from public.profiles where id = uid), true) then
    raise exception 'This account is restricted.';
  end if;

  select user_id, status
    into owner_uid, current_status
  from public.trades
  where id = p_trade_id;

  if owner_uid is null then
    raise exception 'Trade not found.';
  end if;
  if owner_uid = uid then
    raise exception 'You cannot request your own trade.';
  end if;
  if current_status <> 'open' then
    raise exception 'This trade is no longer accepting requests.';
  end if;

  insert into public.trade_requests (
    trade_id, requester_id, owner_id, status,
    requester_completed, owner_completed, updated_at, accepted_at
  )
  values (
    p_trade_id, uid, owner_uid, 'pending',
    false, false, now(), null
  )
  on conflict (trade_id, requester_id)
  do update set
    status = 'pending',
    requester_completed = false,
    owner_completed = false,
    updated_at = now(),
    accepted_at = null
  returning id into req_id;

  return req_id;
end;
$$;

revoke all on function public.request_trade(uuid) from public, anon;
grant execute on function public.request_trade(uuid) to authenticated;

create or replace function public.respond_trade_request(p_request_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req public.trade_requests%rowtype;
begin
  if p_decision not in ('accepted','declined') then
    raise exception 'Invalid trade request decision.';
  end if;

  select * into req
  from public.trade_requests
  where id = p_request_id
  for update;

  if req.id is null then
    raise exception 'Trade request not found.';
  end if;
  if req.owner_id <> uid then
    raise exception 'Only the trade owner can respond to this request.';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request has already been handled.';
  end if;

  if p_decision = 'accepted' then
    if not exists (
      select 1 from public.trades
      where id = req.trade_id and user_id = uid and status = 'open'
    ) then
      raise exception 'This trade is no longer open.';
    end if;

    update public.trade_requests
      set status = 'accepted', accepted_at = now(), updated_at = now()
    where id = p_request_id;

    update public.trade_requests
      set status = 'declined', updated_at = now()
    where trade_id = req.trade_id
      and id <> p_request_id
      and status = 'pending';

    update public.trades
      set status = 'active', updated_at = now()
    where id = req.trade_id and user_id = uid;
  else
    update public.trade_requests
      set status = 'declined', updated_at = now()
    where id = p_request_id;
  end if;
end;
$$;

revoke all on function public.respond_trade_request(uuid,text) from public, anon;
grant execute on function public.respond_trade_request(uuid,text) to authenticated;

create or replace function public.cancel_trade_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req public.trade_requests%rowtype;
begin
  select * into req
  from public.trade_requests
  where id = p_request_id
  for update;

  if req.id is null then
    raise exception 'Trade request not found.';
  end if;
  if req.requester_id <> uid then
    raise exception 'Only the requester can cancel this request.';
  end if;
  if req.status <> 'pending' then
    raise exception 'Only pending requests can be cancelled.';
  end if;

  update public.trade_requests
    set status = 'cancelled', updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.cancel_trade_request(uuid) from public, anon;
grant execute on function public.cancel_trade_request(uuid) to authenticated;

create or replace function public.confirm_trade_complete(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req public.trade_requests%rowtype;
  both_done boolean;
begin
  select * into req
  from public.trade_requests
  where id = p_request_id
  for update;

  if req.id is null then
    raise exception 'Trade request not found.';
  end if;
  if req.status not in ('accepted','completed') then
    raise exception 'This trade has not been accepted.';
  end if;
  if uid not in (req.owner_id, req.requester_id) then
    raise exception 'You are not part of this trade.';
  end if;

  update public.trade_requests
  set
    owner_completed = case when uid = owner_id then true else owner_completed end,
    requester_completed = case when uid = requester_id then true else requester_completed end,
    updated_at = now()
  where id = p_request_id
  returning (owner_completed and requester_completed) into both_done;

  if both_done then
    update public.trade_requests
      set status = 'completed', updated_at = now()
    where id = p_request_id;

    update public.trades
      set status = 'closed', updated_at = now()
    where id = req.trade_id;
  end if;

  return both_done;
end;
$$;

revoke all on function public.confirm_trade_complete(uuid) from public, anon;
grant execute on function public.confirm_trade_complete(uuid) to authenticated;

-- Messaging is trade-scoped and unlocked only by an accepted request.
drop policy if exists "messages sender create" on public.messages;
create policy "messages sender create"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and trade_id is not null
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
  and exists (
    select 1
    from public.trade_requests r
    where r.trade_id = messages.trade_id
      and r.status in ('accepted','completed')
      and (
        (r.owner_id = messages.sender_id and r.requester_id = messages.recipient_id)
        or
        (r.requester_id = messages.sender_id and r.owner_id = messages.recipient_id)
      )
  )
);

-- Realtime request/accept updates make the inbox and trade page update quickly.
do $$
begin
  alter publication supabase_realtime add table public.trade_requests;
exception
  when duplicate_object then null;
end $$;


create or replace function public.cancel_accepted_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req public.trade_requests%rowtype;
begin
  select * into req
  from public.trade_requests
  where trade_id = p_trade_id and status = 'accepted'
  limit 1
  for update;

  if req.id is null then
    raise exception 'No accepted trade was found.';
  end if;
  if uid not in (req.owner_id, req.requester_id) then
    raise exception 'You are not part of this trade.';
  end if;

  update public.trade_requests
    set status = 'cancelled', updated_at = now()
  where id = req.id;

  update public.trades
    set status = 'closed', updated_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.cancel_accepted_trade(uuid) from public, anon;
grant execute on function public.cancel_accepted_trade(uuid) to authenticated;

-- ============================================================
-- V22 hardening: immutable messages + ratings after completion
-- ============================================================

-- Recipients may mark a message read, but cannot rewrite the message itself.
create or replace function public.protect_message_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role/server maintenance has no authenticated end-user uid.
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() <> old.recipient_id then
    raise exception 'Only the recipient can update this message.';
  end if;

  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.trade_id is distinct from old.trade_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read status can be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_protect_fields on public.messages;
create trigger messages_protect_fields
before update on public.messages
for each row execute function public.protect_message_fields();

-- Reputation is tied to a completed accepted trade. This prevents random ratings.
drop policy if exists "ratings create" on public.ratings;
create policy "ratings create"
on public.ratings for insert
with check (
  auth.uid() = rater_id
  and rated_id <> auth.uid()
  and trade_id is not null
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
  and exists (
    select 1
    from public.trade_requests r
    where r.trade_id = ratings.trade_id
      and r.status = 'completed'
      and (
        (r.owner_id = ratings.rater_id and r.requester_id = ratings.rated_id)
        or
        (r.requester_id = ratings.rater_id and r.owner_id = ratings.rated_id)
      )
  )
);

drop policy if exists "ratings own update" on public.ratings;
create policy "ratings own update"
on public.ratings for update
using (auth.uid() = rater_id)
with check (
  auth.uid() = rater_id
  and rated_id <> auth.uid()
  and trade_id is not null
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
  and exists (
    select 1
    from public.trade_requests r
    where r.trade_id = ratings.trade_id
      and r.status = 'completed'
      and (
        (r.owner_id = ratings.rater_id and r.requester_id = ratings.rated_id)
        or
        (r.requester_id = ratings.rater_id and r.owner_id = ratings.rated_id)
      )
  )
);

-- ============================================================
-- V26: completed-chat lock + per-trade ratings + rating trigger fix
-- ============================================================

-- Ratings are one review per completed trade, rather than one lifetime review
-- between the same pair of collectors.
alter table public.ratings drop constraint if exists ratings_rater_id_rated_id_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ratings_rater_rated_trade_key'
      and conrelid = 'public.ratings'::regclass
  ) then
    alter table public.ratings
      add constraint ratings_rater_rated_trade_key
      unique (rater_id, rated_id, trade_id);
  end if;
end $$;

-- A rating insert fires refresh_profile_rating(), which legitimately updates the
-- system-managed aggregate rating fields. Let nested trigger updates through,
-- while still preventing users from editing those columns themselves.
create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if coalesce(auth.role(),'') <> 'service_role' and not public.is_admin(auth.uid()) then
    if new.id is distinct from old.id
       or new.rating_count is distinct from old.rating_count
       or new.rating_avg is distinct from old.rating_avg
       or new.is_admin is distinct from old.is_admin
       or new.is_banned is distinct from old.is_banned
       or new.created_at is distinct from old.created_at
       or new.discord_name is distinct from old.discord_name
       or new.avatar_url is distinct from old.avatar_url then
      raise exception 'You cannot change protected profile fields.';
    end if;
  end if;
  return new;
end;
$$;

-- Completed conversations are permanently read-only. Users can read their
-- history, but new messages only insert while the accepted request is active.
drop policy if exists "messages sender create" on public.messages;
create policy "messages sender create"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and trade_id is not null
  and not coalesce((select is_banned from public.profiles where id = auth.uid()), true)
  and exists (
    select 1
    from public.trade_requests r
    join public.trades t on t.id = r.trade_id
    where r.trade_id = messages.trade_id
      and r.status = 'accepted'
      and t.status = 'active'
      and (
        (r.owner_id = messages.sender_id and r.requester_id = messages.recipient_id)
        or
        (r.requester_id = messages.sender_id and r.owner_id = messages.recipient_id)
      )
  )
);
