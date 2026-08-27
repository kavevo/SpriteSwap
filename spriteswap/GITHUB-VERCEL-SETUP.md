# SpriteSwap: GitHub + Vercel

Keep these files at the **root** of one GitHub repository. Do not nest them inside another `spriteswap/` folder.

## GitHub

Push this build to the same repository already connected to the production SpriteSwap Vercel project. Future commits to the production branch will redeploy automatically.

## Vercel

Keep the existing environment variables in the Vercel project. They do not need to be re-entered for each GitHub deployment:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL=https://spriteswap.xyz`

For a public launch, disable **Vercel Authentication / Deployment Protection** on the production deployment. Discord remains the website login.

## Supabase — V22 required

Run the latest `schema.sql` in Supabase SQL Editor once after deploying V22. The file includes the previous migrations plus the new accepted-trade chat system, so running the full file is the safest path.

After the SQL succeeds, test with two different Discord accounts:

1. Account A posts a trade.
2. Account B requests it.
3. Account A accepts the request.
4. Confirm both accounts see the accepted conversation in Messages.
5. Send a message in each direction.
6. Confirm both users mark the trade complete and it reaches 2/2.
7. Confirm rating becomes available only after completion.
