# SpriteSwap V20

V20 focuses on the live trade experience and final pre-release QA. The trade board now uses larger, readable cards, exact-vault matching controls, a dedicated trade detail page, richer notifications, and stronger full-artwork rules for collection/profile tiles.

**Database:** V20 does not require a new schema migration if V19 `schema.sql` has already been run.

**Deploy:** keep the files at the root of the existing GitHub repository. Your connected Vercel project keeps its existing environment variables and domain.

## Required Vercel variables

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL=https://spriteswap.xyz` (or your chosen canonical production URL)

Never commit secrets to GitHub.

## Pages

- `/` — marketplace, Sprite Vault, trade board, collectors
- `/new-trade.html` — multi-Sprite trade builder
- `/trade.html?id=...` — dedicated trade detail
- `/sprite.html?id=...` — dedicated Sprite detail
- `/profile.html` — profiles, collection, ratings
- `/collection.html` — personal collection manager
- `/messages.html` — trade/direct conversations
- `/notifications.html` — unread messages + vault matches
- `/settings.html` — profile settings

## V21: public access + current/new trade picker

The Post Trade Sprite picker hides Chapter 7 Season 3 entries. Offering shows current/new owned Sprites; Wanted shows current/new released Sprites, including future live-synced entries.

If visitors see a Vercel login before SpriteSwap, disable **Vercel Authentication / SSO Protection** in **Vercel Project Settings → Deployment Protection**. This is a platform setting and cannot be changed by frontend code. Discord remains SpriteSwap's login after it is disabled.
