-- SpriteSwap V26 incremental migration
-- Run this once in Supabase SQL Editor if V25/V22 schema is already installed.

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
