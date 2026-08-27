# SpriteSwap V9 — Discord Login + UI Fixes

This build uses Discord-only sign-in, public Sprite inventories, trading, messaging, ratings, moderation, and resilient Sprite image fallbacks.

## 1. Run the updated SQL
Open Supabase > SQL Editor and run the full `schema.sql` again. It adds `discord_name`, `discord_links`, and the server-only identity update function without deleting your existing trades or inventories.

## 2. Create a Discord application
Go to the Discord Developer Portal and create an application. Under OAuth2, add this exact Redirect URI:

`https://spriteswap.xyz/api/discord-callback`

If your production site uses `www`, add that exact callback too:

`https://www.spriteswap.xyz/api/discord-callback`

The app only requests the `identify` scope.

## 3. Vercel Environment Variables
Add these to the Vercel project that owns `spriteswap.xyz`:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL=https://spriteswap.xyz`

Never put `DISCORD_CLIENT_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` in frontend files.

## 4. Redeploy
After changing environment variables, redeploy the production site.

## 5. Test
Click Discord Login. Discord should return to `/api/discord-callback`, then SpriteSwap should show the Discord display name/avatar in the header.

## UI changes
- Mastering a Sprite now uses a quick card sparkle/pulse instead of the full-screen rare-acquisition popup.
- Missing/broken variant artwork falls back to the base Sprite art, then the local SpriteSwap mascot if needed.
- Hero buttons and navigation spacing are cleaned up and anchor buttons no longer show underlines.


## Discord automatic server join

The Discord OAuth flow requests `identify guilds.join`. Configure `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` in Vercel. The bot must already be in the target server. Users will see Discord's consent screen before the site can join the server for them.
