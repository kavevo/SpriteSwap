# SpriteSwap V19 — pre-release trade-builder build

SpriteSwap is a Discord-authenticated Sprite trading community with public inventories, exact-variant collection tracking, live trades, messages, ratings, reports/moderation, live catalog syncing, and automatic Discord-server joining when configured.

## Required V19 database update
Open **Supabase → SQL Editor** and run the latest `schema.sql` once.

V19 adds backward-compatible multi-Sprite fields to `public.trades`:

- `offer_items text[]`
- `want_items text[]`

Older single-Sprite trades are backfilled automatically. This is the only new setup step for V19.

## Vercel environment variables
Keep these on the same Vercel project:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL=https://spriteswap.xyz`

Never expose the Discord client secret, bot token, or Supabase service-role key in frontend files or GitHub.

## Discord OAuth
The callback is:

`https://spriteswap.xyz/api/discord-callback`

The app requests `identify` and `guilds.join`. `guilds.join` is used only for the server-join feature and requires your bot to already be in the target Discord server.

## V19 highlights

- New multi-Sprite Post Trade builder with up to 8 Sprites on each side.
- Offering side is restricted to Sprites the signed-in user actually owns.
- Wanted side uses released Sprites from the live catalog.
- Exact-variant matching: Gold/Galaxy/Gummy/etc. are never treated as interchangeable.
- Local trade-draft autosave.
- Live trade cards support multi-Sprite offers/wants, relative post age, and vault-match intelligence.
- Messages and Sprite detail pages support multi-Sprite listings.
- Public profile and My Collection tiles use a definitive full-art layout to stop Sprite cropping.
- Live Fortnite.GG catalog sync from V16+ remains enabled, including the daily Vercel cron fallback.

## GitHub → Vercel
Keep these files at the **root** of the GitHub repository. Push to `main`; the connected Vercel project will redeploy while retaining its existing domain and environment variables.
