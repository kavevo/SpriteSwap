import { createClient } from '@supabase/supabase-js';
import { syncFortniteSprites } from '../lib/fortnite-sprites.js';

const STALE_MS = 30 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRole) return res.status(503).json({ sprites: [], error: 'catalog sync not configured' });

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession:false, autoRefreshToken:false } });
  let sync = null;
  try {
    const { data: meta } = await admin.from('sprite_sync_state').select('last_synced_at').eq('id','fortnitegg').maybeSingle();
    const last = meta?.last_synced_at ? new Date(meta.last_synced_at).getTime() : 0;
    if (!last || Date.now() - last > STALE_MS) sync = await syncFortniteSprites(admin);
  } catch (err) {
    console.error('catalog sync', err?.message || err);
  }

  const { data, error } = await admin.from('sprite_catalog').select('id,name,base,variant,rarity,chance,season,image,unreleased,source_url,first_seen_at,last_seen_at').order('first_seen_at',{ascending:true});
  if (error) return res.status(500).json({ sprites: [], error: error.message });
  return res.status(200).json({ sprites: data || [], sync });
}
