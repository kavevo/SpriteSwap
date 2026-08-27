import { createClient } from '@supabase/supabase-js';

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}
function clearCookie(name){ return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`; }
function profileUsername(value='DiscordUser', fallbackId=''){
  let v=String(value||'DiscordUser').replace(/[^A-Za-z0-9_]/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'').slice(0,24);
  if(v.length<3) v=`user_${String(fallbackId).slice(-8)}`;
  return v.slice(0,24);
}
function discordAvatar(user){
  if(user?.avatar){
    const ext=String(user.avatar).startsWith('a_')?'gif':'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
  }
  if(!user?.id) return '';
  const legacy=String(user.discriminator||'0');
  const index=legacy !== '0' ? Number(legacy)%5 : Number((BigInt(user.id)>>22n)%6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export default async function handler(req, res) {
  const siteUrl = String(process.env.SITE_URL || `https://${req.headers.host}`).trim().replace(/\/$/, '');
  const redirectUri = `${siteUrl}/api/discord-callback`;
  const { code, state, error, error_description } = req.query;
  const cookies = parseCookies(req);
  res.setHeader('Set-Cookie', clearCookie('discord_oauth_state'));

  if(error) return res.redirect(302, `/?discord_error=${encodeURIComponent(error_description || error)}`);
  if(!code || !state || state !== cookies.discord_oauth_state) return res.status(400).send('Discord login could not be verified. Please try again.');

  const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim();
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if(!clientId || !clientSecret || !supabaseUrl || !serviceRole) return res.status(503).send('Server login secrets are not configured in Vercel yet.');

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: String(code),
    redirect_uri: redirectUri
  });
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: tokenBody
  });
  const token = await tokenRes.json().catch(()=>({}));
  if(!tokenRes.ok) return res.status(502).send(`Discord token exchange failed: ${token.error_description || token.error || tokenRes.status}. Redirect used: ${redirectUri}`);

  const userRes = await fetch('https://discord.com/api/users/@me', {headers:{Authorization:`Bearer ${token.access_token}`}});
  const discord = await userRes.json().catch(()=>({}));
  if(!userRes.ok || !discord.id) return res.status(502).send('Discord returned a login token, but the profile lookup failed.');

  // Optional automatic server join. Discord shows this permission on the OAuth consent screen.
  const guildId = String(process.env.DISCORD_GUILD_ID || '').trim();
  const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim();
  let guildJoinStatus = 'not_configured';
  if(guildId && botToken){
    const joinRes = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discord.id)}`, {
      method:'PUT',
      headers:{
        'Authorization':`Bot ${botToken}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({access_token:token.access_token})
    });
    if(joinRes.ok || joinRes.status===204){
      guildJoinStatus='joined';
    }else{
      const joinError=await joinRes.json().catch(()=>({}));
      console.error('Discord guild join failed', joinRes.status, joinError);
      guildJoinStatus=`failed_${joinRes.status}`;
    }
  }

  const admin = createClient(supabaseUrl, serviceRole, {auth:{autoRefreshToken:false,persistSession:false}});
  const {data:link} = await admin.from('discord_links').select('user_id').eq('discord_user_id', String(discord.id)).maybeSingle();
  let userId = link?.user_id || null;
  const pseudoEmail = `discord-${discord.id}@login.spriteswap.invalid`;
  const displayName = String(discord.global_name || discord.username || 'Discord User').slice(0,40);
  const discordUsername = String(discord.username || displayName || 'DiscordUser').slice(0,40);
  const profileName = profileUsername(discordUsername, discord.id);
  const avatarUrl = discordAvatar(discord);

  if(!userId){
    let username=profileName;
    const {data:nameTaken}=await admin.from('profiles').select('id').eq('username',username).neq('id', userId||'00000000-0000-0000-0000-000000000000').maybeSingle();
    if(nameTaken) username=`${profileName.slice(0,17)}_${String(discord.id).slice(-6)}`.slice(0,24);
    const created=await admin.auth.admin.createUser({
      email:pseudoEmail,
      email_confirm:true,
      user_metadata:{username,discord_name:displayName,avatar_url:avatarUrl}
    });
    if(created.error && !String(created.error.message).toLowerCase().includes('already')) return res.status(500).send(`Could not create SpriteSwap account: ${created.error.message}`);
    userId=created.data?.user?.id;
    if(!userId){
      let page=1, found=null;
      while(page<=5 && !found){
        const r=await admin.auth.admin.listUsers({page,perPage:200});
        found=r.data?.users?.find(u=>u.email===pseudoEmail);
        if((r.data?.users||[]).length<200) break;
        page++;
      }
      userId=found?.id;
    }
    if(!userId) return res.status(500).send('Could not resolve the SpriteSwap account for this Discord user.');
  }

  // Discord identity is the account identity. Keep it synced on every login.
  let syncedUsername=profileName;
  const {data:conflict}=await admin.from('profiles').select('id').eq('username',syncedUsername).neq('id',userId).maybeSingle();
  if(conflict) syncedUsername=`${profileName.slice(0,17)}_${String(discord.id).slice(-6)}`.slice(0,24);
  const identityUpdate = await admin.rpc('set_discord_identity',{target_user:userId,account_username:syncedUsername,display_name:displayName,avatar:avatarUrl});
  if(identityUpdate.error){
    console.error('Discord identity sync failed', identityUpdate.error);
    return res.status(500).send(`Discord login worked, but profile sync failed: ${identityUpdate.error.message}. Run the latest schema.sql in Supabase.`);
  }

  await admin.from('discord_links').upsert({
    user_id:userId,
    discord_user_id:String(discord.id),
    discord_username:discordUsername,
    discord_display_name:displayName,
    avatar_url:avatarUrl
  }, {onConflict:'user_id'});

  const magic=await admin.auth.admin.generateLink({type:'magiclink',email:pseudoEmail,options:{redirectTo:siteUrl}});
  if(magic.error || !magic.data?.properties?.action_link) return res.status(500).send(`Discord was verified, but SpriteSwap could not start a session: ${magic.error?.message || 'missing link'}`);
  const actionUrl=new URL(magic.data.properties.action_link);
  if(guildJoinStatus==='failed_403' || guildJoinStatus==='failed_404') actionUrl.searchParams.set('discord_join_warning','1');
  res.redirect(302, actionUrl.toString());
}
