# SpriteSwap: GitHub + Vercel

This build is ready to live in one GitHub repository instead of being re-uploaded as ZIP files.

## One-time GitHub setup
1. Create a GitHub repository named `spriteswap`.
2. Upload/push the contents of this `spriteswap` folder to the repository root.
3. Do **not** commit real secrets. `.env` files are ignored.

## One-time Vercel setup
1. Open the existing Vercel project that owns `spriteswap.xyz`.
2. Connect that existing project to the GitHub `spriteswap` repository.
3. Keep the environment variables already stored in Vercel:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL=https://spriteswap.xyz`
4. Future pushes to the production branch will deploy the same Vercel project. You do not need to re-enter those environment variables every update.

## Important V12 database step
Run the latest `schema.sql` in Supabase once. V12 fixes the trigger that previously blocked Discord display name/avatar synchronization.

## V19 database step
Before testing the new multi-Sprite trade builder, run the latest `schema.sql` in Supabase SQL Editor once. It adds `offer_items` and `want_items` to existing trades without deleting old listings.
