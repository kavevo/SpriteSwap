import crypto from 'node:crypto';

function cookie(name, value, maxAge = 600) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export default async function handler(req, res) {
  const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
  if (!clientId) return res.status(503).send('Discord login is not configured yet. Add DISCORD_CLIENT_ID in Vercel.');

  const siteUrl = String(process.env.SITE_URL || `https://${req.headers.host}`).trim().replace(/\/$/, '');
  const redirectUri = `${siteUrl}/api/discord-callback`;
  const state = crypto.randomBytes(24).toString('hex');

  res.setHeader('Set-Cookie', cookie('discord_oauth_state', state));
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify guilds.join',
    state,
    prompt: 'consent'
  });
  res.redirect(302, `https://discord.com/oauth2/authorize?${params.toString()}`);
}
