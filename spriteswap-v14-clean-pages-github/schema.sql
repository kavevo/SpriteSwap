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
