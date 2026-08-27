import { load } from 'cheerio';
import baseline from '../data/sprites-baseline.js';

const LIST_URL = 'https://fortnite.gg/sprites';
const USER_AGENT = 'SpriteSwap/1.1 (+https://spriteswap.xyz; public Sprite catalog sync)';
const VARIANTS = ['Cheat Master','Holofoil','Galaxy','Gummy','Gold','Gem','Cube','Quack','Base'];
const baselineByName = new Map(baseline.map(s => [String(s.name || '').trim().toLowerCase(), s]));

const collapse = (s='') => String(s).replace(/\s+/g,' ').trim();
const slugify = (s='') => collapse(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
const absolute = (u, base=LIST_URL) => { try { return new URL(u, base).href; } catch { return ''; } };
const titleCase = (s='') => s.split(/[-\s]+/).filter(Boolean).map(w => w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase()+w.slice(1)).join(' ');

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Fortnite.GG ${res.status} for ${url}`);
  return res.text();
}

function listLinks(html) {
  const $ = load(html), found = new Map();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/^\/sprites\/(\d+)-([^?#]+?)-sprite\/?$/i);
    if (!m) return;
    const imgAlt = collapse($(el).find('img[alt]').first().attr('alt') || '').replace(/\s+Sprite$/i,'');
    let textName = collapse($(el).clone().children().remove().end().text()).replace(/\s+Sprite$/i,'');
    if (!textName || /(?:special|mythic|legendary|epic|rare|owned|mastered|missing|\d+%)/i.test(textName)) textName='';
    const slugName = titleCase(m[2].replace(/-/g,' '));
    const name = imgAlt || textName || slugName;
    const source_url = absolute(href);
    if (name && source_url && !found.has(source_url)) found.set(source_url, { name, source_url });
  });
  return [...found.values()];
}

function displayVariant(raw='', name='') {
  const r = collapse(raw).toLowerCase();
  if (r === 'candy') return 'Gummy';
  const exact = VARIANTS.find(v => v.toLowerCase() === r);
  if (exact) return exact;
  return VARIANTS.find(v => v !== 'Base' && name.toLowerCase().startsWith(v.toLowerCase()+' ')) || 'Base';
}

function parseDetail(html, sourceUrl, fallbackName='') {
  const $ = load(html);
  const heading = collapse($('h1').first().text()) || fallbackName;
  const name = heading.replace(/\s+Sprite$/i,'').trim();
  const text = collapse($('body').text());
  const variantMatch = text.match(/Variant\s+([^]+?)\s+Summon Cost/i);
  const variant = displayVariant(variantMatch?.[1] || '', name);
  const rc = text.match(/\b(mythic|legendary|epic|rare|special)\s+([0-9.]+%)\b/i);
  const rarity = (rc?.[1] || (variant === 'Base' ? 'rare' : 'special')).toLowerCase();
  const chance = rc?.[2] || '0%';

  // OG image is the most reliable exact variant artwork on Fortnite.GG detail pages.
  let image = $('meta[property="og:image"]').attr('content') ||
    $('a').filter((_,el)=>/Image:\s*/i.test($(el).text()) || /sprite/i.test($(el).attr('aria-label')||'')).first().attr('href') ||
    $('img').filter((_,el)=>new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test($(el).attr('alt')||'')).first().attr('src') || '';
  image = absolute(image, sourceUrl);

  let base = name;
  if (variant !== 'Base' && name.toLowerCase().startsWith(variant.toLowerCase()+' ')) base = name.slice(variant.length+1).trim();
  const baselineRow = baselineByName.get(name.toLowerCase());
  return {
    id: baselineRow?.id || slugify(name),
    source_url: sourceUrl,
    name,
    base: baselineRow?.base || base,
    variant,
    rarity,
    chance,
    season: baselineRow?.season || 'Latest',
    image,
    unreleased: /\bUnreleased\b/i.test(text),
    source: 'fortnite.gg',
    last_seen_at: new Date().toISOString()
  };
}

function refreshPriority(item, existingByName) {
  const b = baselineByName.get(item.name.toLowerCase());
  const existing = existingByName.get(item.name.toLowerCase());
  if (!existing) {
    if (b?.variant === 'Gummy') return 100;
    if (b && ['Fire','Water','Earth'].includes(b.base) && b.variant !== 'Base') return 95;
    return b ? 40 : 120; // new entries first, then baseline verification
  }
  const age = existing.last_seen_at ? Date.now()-new Date(existing.last_seen_at).getTime() : Infinity;
  return age > 7*86400000 ? 35 : 0;
}

export async function syncFortniteSprites(admin, { maxChecks = 28 } = {}) {
  const listHtml = await fetchHtml(LIST_URL);
  const links = listLinks(listHtml);
  const { data: existingRows, error: existingError } = await admin.from('sprite_catalog').select('id,source_url,name,image,last_seen_at');
  if (existingError) throw existingError;
  const existingByName = new Map((existingRows||[]).map(r=>[String(r.name||'').toLowerCase(),r]));

  // Unlike V16, refresh existing/baseline entries too. This lets Fortnite.GG correct old guessed
  // asset filenames (notably Gummy/Candy and the Fire/Water/Earth variant assets).
  const candidates = links
    .map((x,i)=>({...x, _i:i, _p:refreshPriority(x,existingByName)}))
    .filter(x=>x._p>0)
    .sort((a,b)=>b._p-a._p || a._i-b._i)
    .slice(0,maxChecks);

  const parsed=[];
  for (const item of candidates) {
    try {
      const html=await fetchHtml(item.source_url);
      const row=parseDetail(html,item.source_url,item.name);
      if (row.name && row.image) parsed.push(row);
    } catch (err) { console.error('sprite detail sync failed',item.source_url,err?.message||err); }
  }
  if (parsed.length) {
    const { error }=await admin.from('sprite_catalog').upsert(parsed,{onConflict:'id'});
    if(error) throw error;
  }
  const now=new Date().toISOString();
  const newCount=parsed.filter(r=>!baselineByName.has(r.name.toLowerCase())&&!existingByName.has(r.name.toLowerCase())).length;
  await admin.from('sprite_sync_state').upsert({id:'fortnitegg',last_synced_at:now,last_found_count:links.length,last_new_count:newCount},{onConflict:'id'});
  return {checked:links.length,refreshed:parsed.length,added:newCount,syncedAt:now};
}
