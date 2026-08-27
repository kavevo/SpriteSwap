# SpriteSwap V22 — Accepted Trade Chat

V22 turns the marketplace into a safer trade flow instead of open direct messages:

1. A collector opens a live listing and sends a **trade request**.
2. The listing owner reviews pending requests and accepts one.
3. Acceptance removes the listing from the public open board and unlocks one private **trade chat** for those two users.
4. Both traders coordinate the in-game Sprite swap in Messages.
5. Each trader presses **Mark completed**. At 2/2 confirmations the trade becomes completed and can be rated.

V22 also replaces browser confirm popups with SpriteSwap modals, adds trade-request/acceptance notifications, realtime trade chat updates, accepted-trade details in Messages, and server-side rules that block messaging before acceptance.

## Required database step

Run the **entire latest `schema.sql`** once in Supabase SQL Editor before testing V22. It is designed to be re-runnable and preserves existing profiles, inventories, ratings, messages, and trade listings.

The V22 migration adds/updates:

- `trade_requests`
- trade status `active`
- request / accept / decline / cancel RPCs
- 2-party completion confirmations
- accepted-trade-only message inserts
- message immutability (recipients can only change `read_at`)
- ratings restricted to completed accepted trades

## Required Vercel variables

Keep the variables already attached to the same Vercel project:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL=https://spriteswap.xyz`

Never commit secret values to GitHub.

## Public access

Vercel Deployment Protection / Vercel Authentication should be disabled for the production site. SpriteSwap itself uses Discord authentication; visitors should never need a Vercel account.

## Main pages

- `/` — marketplace, Sprite Vault, live trade board, collectors
- `/new-trade.html` — multi-Sprite trade builder
- `/trade.html?id=...` — request/accept/complete trade flow
- `/messages.html` — accepted trade chats only
- `/notifications.html` — requests, acceptances, unread trade messages, vault matches
- `/sprite.html?id=...` — Sprite details + live listings
- `/profile.html` — public profile, collection, completed-trade ratings
- `/collection.html` — personal collection manager
- `/settings.html` — profile settings
- `/report.html` — moderation reports
- `/admin.html` — moderation dashboard


## V23 trade-picker fix
- Offering side shows only Chapter 7 Season 4 Sprites that are marked Owned.
- Chapter 7 Season 3 / legacy Sprites cannot be offered.
- Looking For remains current/new released Sprites only.
- This prevents established collections from being unable to post trades.
