(() => {
const cfg=window.SPRITESWAP_CONFIG||{}, sb=(cfg.supabaseUrl&&cfg.supabaseAnonKey)?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null, sprites=window.SPRITES||[];
const $=s=>document.querySelector(s), P=new URLSearchParams(location.search), esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])), fmt=v=>new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}), rel=v=>{const n=Date.now()-new Date(v).getTime(),s=Math.max(0,Math.floor(n/1000));if(s<10)return'just now';if(s<60)return`${s}s ago`;const m=Math.floor(s/60);if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;const d=Math.floor(h/24);return d<30?`${d}d ago`:new Date(v).toLocaleDateString()};
const ico=n=>({bell:'<svg class="icon" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',msg:'<svg class="icon" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',user:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',grid:'<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',plus:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'}[n]||'');
const sprite=id=>sprites.find(s=>s.id===id), avatar=p=>p?.avatar_url||'assets/spriteswap-sprite-logo-128.png', name=p=>p?.discord_name||p?.username||'Collector';
const variantClass=v=>`variant-${String(v||'Base').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
const baseArt=sp=>sprites.find(x=>x.base===sp?.base&&x.variant==='Base'&&x.image)?.image||'assets/spriteswap-sprite-logo-128.png';
const variantBadge=sp=>`<span class="mini-variant-badge ${variantClass(sp.variant)}">${esc(sp.variant||'Base')}</span><span class="mini-rarity-badge ${esc(sp.rarity||'rare')}">${esc((sp.rarity||'rare').toUpperCase())}</span>`;
const tradeItems=(t,side)=>{const key=side==='offer'?'offer_items':'want_items',arr=Array.isArray(t?.[key])?t[key].filter(Boolean):[];return arr.length?arr:[String(t?.[side]||'').trim()].filter(Boolean)};

function pageToast(message,bad=false){
  let el=document.getElementById('pageToast');
  if(!el){el=document.createElement('div');el.id='pageToast';el.className='page-toast';document.body.appendChild(el)}
  el.textContent=message;el.classList.toggle('bad',!!bad);el.classList.add('show');
  clearTimeout(pageToast._t);pageToast._t=setTimeout(()=>el.classList.remove('show'),3200);
}
function confirmAction({title='Are you sure?',message='',confirmText='Confirm',cancelText='Cancel',danger=false}={}){
  return new Promise(resolve=>{
    let d=document.getElementById('siteConfirmDialog');
    if(!d){
      d=document.createElement('dialog');d.id='siteConfirmDialog';d.className='site-confirm-dialog';
      d.innerHTML='<form method="dialog" class="site-confirm-card"><span class="site-confirm-icon">!</span><div class="site-confirm-copy"><h3 id="siteConfirmTitle"></h3><p id="siteConfirmMessage"></p></div><div class="site-confirm-actions"><button value="cancel" class="btn btn-secondary" id="siteConfirmCancel"></button><button value="confirm" class="btn" id="siteConfirmOkay"></button></div></form>';
      document.body.appendChild(d);
    }
    d.querySelector('#siteConfirmTitle').textContent=title;
    d.querySelector('#siteConfirmMessage').textContent=message;
    d.querySelector('#siteConfirmCancel').textContent=cancelText;
    const ok=d.querySelector('#siteConfirmOkay');ok.textContent=confirmText;ok.className=`btn ${danger?'btn-danger':'btn-primary'}`;
    const done=()=>{d.removeEventListener('close',done);resolve(d.returnValue==='confirm')};
    d.addEventListener('close',done);d.showModal();
  });
}

function acceptTradeWarning(traderName='this trader'){
  return new Promise(resolve=>{
    let d=document.getElementById('acceptTradeDialog');
    if(!d){
      d=document.createElement('dialog');d.id='acceptTradeDialog';d.className='accept-trade-dialog';
      d.innerHTML=`<form method="dialog" class="accept-trade-card">
        <button class="accept-trade-close" value="cancel" aria-label="Close">×</button>
        <div class="accept-trade-head"><span>⚠</span><div><h3>Before you accept</h3><p>Accepting locks this listing to one trader and unlocks the private trade chat.</p></div></div>
        <div class="accept-trade-warning"><b>ONLY ACCEPT IF YOU INTEND TO COMPLETE THE SWAP</b><span>The chat is for coordinating the in-game Sprite swap—not account access or payments.</span></div>
        <div class="accept-trade-rules"><b>PERMANENTLY SUSPENDABLE</b><span>⊘ Accepting as a joke or wasting another trader’s time</span><span>⊘ Scamming or attempting to scam another trader</span><span>⊘ Real-money trades, gift cards, crypto, or paid services</span><span>⊘ Asking for passwords, login codes, or account access</span><span>⊘ Taking deals off-platform to avoid moderation</span></div>
        <label class="accept-trade-check"><input id="acceptTradeCheck" type="checkbox"> <span>I understand and want to trade with <b id="acceptTradeName"></b>.</span></label>
        <div class="accept-trade-actions"><button value="cancel" class="btn btn-secondary">Not yet</button><button id="acceptTradeConfirm" value="confirm" class="btn btn-primary" disabled>Accept trade</button></div>
      </form>`;
      document.body.appendChild(d);
      const check=d.querySelector('#acceptTradeCheck'),button=d.querySelector('#acceptTradeConfirm');
      check.addEventListener('change',()=>button.disabled=!check.checked);
    }
    d.querySelector('#acceptTradeName').textContent=traderName;
    const check=d.querySelector('#acceptTradeCheck'),button=d.querySelector('#acceptTradeConfirm');check.checked=false;button.disabled=true;
    const done=()=>{d.removeEventListener('close',done);resolve(d.returnValue==='confirm')};d.addEventListener('close',done);d.showModal();
  });
}

async function loadLiveCatalog(){
  try{
    const r=await fetch('/api/sprites',{headers:{accept:'application/json'}}); if(!r.ok)return;
    const j=await r.json(), rows=Array.isArray(j.sprites)?j.sprites:[], byId=new Map(sprites.map((s,i)=>[s.id,i]));
    for(const row of rows){
      if(!row?.id||!row?.name||!row?.image)continue;
      const next={id:row.id,name:row.name,base:row.base||row.name,variant:row.variant||'Base',rarity:row.rarity||'rare',chance:row.chance||'0%',season:row.season||'Latest',image:row.image,unreleased:!!row.unreleased,source_url:row.source_url||'',first_seen_at:row.first_seen_at||'',live_catalog:true};
      if(byId.has(next.id))sprites[byId.get(next.id)]={...sprites[byId.get(next.id)],...next}; else {byId.set(next.id,sprites.length);sprites.push(next)}
    }
  }catch(e){console.warn('live catalog unavailable',e)}
}
async function ses(){return sb?(await sb.auth.getSession()).data.session:null} async function profile(id){return (await sb.from('profiles').select('*').eq('id',id).single()).data} async function mine(){const s=await ses();return s?profile(s.user.id):null}
function header(){const el=$('#pageHeader');if(!el)return;el.innerHTML=`<header class="site-header"><div class="header-inner"><a class="brand" href="/"><span class="brand-mark"><img src="assets/spriteswap-sprite-logo-128.png"></span><span>SPRITE<span class="brand-pop">SWAP</span></span></a><div class="header-search"><span>⌕</span><input placeholder="Search sprites, traders or IDs" onkeydown="if(event.key==='Enter')location.href='/?q='+encodeURIComponent(this.value)+'#sprites'"><kbd>/</kbd></div><nav><a href="/#trades">Trades</a><a href="/#sprites">Sprite Index</a><a href="/#community">Community</a><button id="pageMessages" class="nav-icon-btn" aria-label="Messages">${ico('msg')}</button><button id="pageNotifications" class="nav-icon-btn" aria-label="Notifications">${ico('bell')}</button><div class="page-account-shell"><button id="pageUser" class="btn btn-glass page-user-btn">${ico('user')}<span>Login</span></button><div id="pageAccountMenu" class="page-account-menu hidden"><div id="pageAccountIdentity" class="account-menu-identity"></div><a href="/profile.html">Profile</a><a href="/collection.html">My Collection</a><a href="/messages.html">Messages</a><a href="/settings.html">Settings</a><button id="pageLogout" class="danger-text">Log out</button></div></div><a class="btn btn-primary" href="/new-trade.html">${ico('plus')} Post trade</a></nav></div></header>`}
async function headerAuth(){const s=await ses(),p=s?await profile(s.user.id):null,u=$('#pageUser'),menu=$('#pageAccountMenu');if(u){u.innerHTML=s?`<img src="${esc(avatar(p))}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'"><span>${esc(name(p))}</span><b class="account-chevron">⌄</b>`:`${ico('user')}<span>Discord Login</span>`;u.onclick=()=>{if(!s)return location.href='/api/discord-login';menu?.classList.toggle('hidden')}}if(s&&$('#pageAccountIdentity'))$('#pageAccountIdentity').innerHTML=`<img src="${esc(avatar(p))}"><div><b>${esc(name(p))}</b><span>@${esc(p?.username||'collector')}</span></div>`;$('#pageLogout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='/'});$('#pageMessages')?.addEventListener('click',()=>location.href='/messages.html');$('#pageNotifications')?.addEventListener('click',()=>location.href='/notifications.html')}
async function need(){const s=await ses();if(!s)location.href='/api/discord-login';return s}
async function profilePage(){
  header(); await headerAuth();
  const s=await ses(), id=P.get('id')||s?.user.id;
  if(!id) return location.href='/api/discord-login';
  const [{data:p},{data:inv},{data:rs},{data:ts}]=await Promise.all([
    sb.from('profiles').select('*').eq('id',id).single(),
    sb.from('sprite_inventory').select('*').eq('user_id',id).eq('owned',true),
    sb.from('ratings').select('*,rater:rater_id(username,discord_name,avatar_url)').eq('rated_id',id).order('created_at',{ascending:false}),
    sb.from('trades').select('id,status').eq('user_id',id)
  ]);
  if(!p) return;
  const items=(inv||[]).map(r=>({r,s:sprite(r.sprite_id)})).filter(x=>x.s);
  const mastered=items.filter(x=>x.r.mastered).length, pct=Math.round(items.length/Math.max(sprites.length,1)*100);
  const counts={mythic:0,legendary:0,epic:0,rare:0,special:0}; items.forEach(x=>counts[x.s.rarity]=(counts[x.s.rarity]||0)+1); const variants={};items.forEach(x=>variants[x.s.variant]=(variants[x.s.variant]||0)+1);
  const closed=(ts||[]).filter(t=>t.status==='closed').length, open=(ts||[]).filter(t=>t.status==='open').length, own=id===s?.user.id;
  const reviewHtml=(rs||[]).length?(rs||[]).map(r=>`<article class="review-row"><div class="review-user"><img src="${esc(avatar(r.rater))}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'"><b>${esc(name(r.rater))}</b></div><span class="rating">${'★'.repeat(r.stars)}</span><p>${esc(r.comment||'No written review.')}</p></article>`).join(''):'<div class="empty">No reviews yet.</div>';
  const ratingMode=P.get('rate')==='1'&&!own;
  const ratingForm=ratingMode?`<form id="pageRatingForm" class="page-card" style="padding:14px;margin-bottom:12px"><div class="page-topbar"><div><h3 style="margin:0">Rate this collector</h3><p class="subtle">Leave feedback after a completed trade.</p></div></div><label>Stars<select name="stars"><option value="5">★★★★★ — Excellent</option><option value="4">★★★★☆ — Good</option><option value="3">★★★☆☆ — Okay</option><option value="2">★★☆☆☆ — Poor</option><option value="1">★☆☆☆☆ — Bad</option></select></label><label>Comment<input name="comment" maxlength="160" placeholder="Fast, fair trade…"></label><button class="btn btn-primary" type="submit">Submit rating</button><p id="pageRatingNote" class="form-note"></p></form>`:'';
  const profileVariants=[...new Set(items.map(x=>x.s.variant))].sort();
  const collectionHtml=items.length?items.map(({r,s:sp})=>`<article class="mini-sprite ${esc(sp.rarity)} ${variantClass(sp.variant)}" data-profile-sprite data-name="${esc(sp.name.toLowerCase())}" data-variant="${esc(sp.variant)}" data-rarity="${esc(sp.rarity)}" data-mastered="${r.mastered?'1':'0'}" title="${esc(sp.name)}">${variantBadge(sp)}<a class="mini-sprite-open" href="/sprite.html?id=${encodeURIComponent(sp.id)}" aria-label="View ${esc(sp.name)} details">${esc(sp.name)}</a><div class="mini-sprite-thumb"><span class="variant-fx"></span><img src="${esc(sp.image)}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else this.src='assets/spriteswap-sprite-logo-128.png'" data-fallback="${esc(baseArt(sp))}" alt="${esc(sp.name)}"></div><div class="mini-sprite-copy"><strong>${esc(sp.name)}</strong><small>${esc(sp.chance||'0%')} drop chance · ${esc((sp.rarity||'rare').toUpperCase())}</small></div>${r.mastered?'<b class="master-star">★</b>':''}</article>`).join(''):'<div class="empty">No public Sprites collected yet.</div>';
  $('#profileRoot').innerHTML=`
    <section class="profile-page-hero">
      <div class="profile-identity"><img class="profile-avatar-xl" src="${esc(avatar(p))}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'"><div><h1>${esc(name(p))}</h1><div class="profile-meta"><span>★ ${Number(p.rating_avg||0).toFixed(1)} (${p.rating_count||0})</span><span>• Joined ${new Date(p.created_at).toLocaleDateString([],{month:'short',year:'numeric'})}</span>${own?'<span class="online">● Your profile</span>':''}</div><div class="profile-meta" style="margin-top:8px"><span>Discord · @${esc(p.username||'collector')}</span></div></div></div>
      <div><div class="profile-actions-row">${own?'<a class="btn btn-secondary" href="/collection.html">My collection</a><a class="btn btn-secondary" href="/settings.html">Edit profile</a>':`<a class="btn btn-primary" href="/?q=${encodeURIComponent(name(p))}#trades">View live trades</a>`}<button id="shareProfileBtn" class="btn btn-secondary" type="button">Share profile</button></div><div id="profileShareNote" class="profile-share-note"></div></div>
    </section>
    <div class="profile-grid-stats">
      <article class="profile-stat"><span>TRADES DONE</span><strong>${closed}</strong><small>${open} open right now</small></article>
      <article class="profile-stat"><span>SPRITES INDEXED</span><strong>${items.length}<small> / ${sprites.length}</small></strong><small>${pct}% collected</small></article>
      <article class="profile-stat"><span>MASTERED</span><strong>${mastered}</strong><small>${counts.mythic||0} mythic owned</small></article>
      <article class="profile-stat"><span>RATING</span><strong>★ ${Number(p.rating_avg||0).toFixed(1)}</strong><small>${p.rating_count||0} reviews</small></article>
    </div>
    <section class="page-card collection-summary"><div class="collection-summary-head"><b>${items.length} of ${sprites.length} Sprites collected</b><strong style="color:var(--yellow)">${pct}%</strong></div><div class="summary-bar"><i style="width:${pct}%"></i></div><div class="variant-breakdown"><div>MYTHIC <b style="float:right">${counts.mythic||0}</b></div><div>LEGENDARY <b style="float:right">${counts.legendary||0}</b></div><div>EPIC <b style="float:right">${counts.epic||0}</b></div><div>RARE <b style="float:right">${counts.rare||0}</b></div><div>SPECIAL <b style="float:right">${counts.special||0}</b></div></div><div class="profile-variant-summary">${Object.entries(variants).sort((a,b)=>b[1]-a[1]).map(([v,c])=>`<span class="variant-summary-chip ${variantClass(v)}"><b>${esc(v)}</b>${c}</span>`).join('')}</div></section>
    <div class="profile-tabs"><button class="active" data-profile-tab="collection">Collection ${items.length}</button><button data-profile-tab="reviews">Reviews ${(rs||[]).length}</button></div>
    <section id="profileCollectionPanel" class="page-card profile-panel" style="padding:16px">
      <div class="page-topbar"><div><h2 style="margin:0">Collection</h2><p class="subtle">${esc(p.bio||'No bio yet.')}</p></div><span class="subtle">${mastered} mastered</span></div>
      ${items.length?`<div class="profile-collection-toolbar"><input id="profileCollectionSearch" type="search" placeholder="Search ${esc(name(p))}'s collection…"><select id="profileCollectionVariant"><option value="all">All variants</option>${profileVariants.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select><select id="profileCollectionRarity"><option value="all">All rarities</option><option value="mythic">Mythic</option><option value="legendary">Legendary</option><option value="epic">Epic</option><option value="rare">Rare</option><option value="special">Special</option></select><select id="profileCollectionState"><option value="all">All owned</option><option value="mastered">Mastered</option><option value="unmastered">Not mastered</option></select></div><div class="profile-collection-result"><span id="profileCollectionCount">${items.length}</span> shown</div>`:''}
      <div class="profile-collection-grid">${collectionHtml}</div>
    </section>
    <section id="profileReviewsPanel" class="page-card profile-panel ${ratingMode?'':'hidden'}" style="padding:16px"><div class="page-topbar"><div><h2 style="margin:0">Reviews</h2><p class="subtle">Recent reputation from other collectors.</p></div></div>${ratingForm}<div class="profile-reviews">${reviewHtml}</div></section>`;
  if(ratingMode){$('#profileRoot').querySelectorAll('[data-profile-tab]').forEach(x=>x.classList.toggle('active',x.dataset.profileTab==='reviews'));$('#profileCollectionPanel').classList.add('hidden');}
  $('#profileRoot').addEventListener('click',e=>{const b=e.target.closest('[data-profile-tab]');if(!b)return;$('#profileRoot').querySelectorAll('[data-profile-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#profileCollectionPanel').classList.toggle('hidden',b.dataset.profileTab!=='collection');$('#profileReviewsPanel').classList.toggle('hidden',b.dataset.profileTab!=='reviews');});
  const applyProfileCollection=()=>{const q=($('#profileCollectionSearch')?.value||'').trim().toLowerCase(),v=$('#profileCollectionVariant')?.value||'all',r=$('#profileCollectionRarity')?.value||'all',st=$('#profileCollectionState')?.value||'all';let shown=0;document.querySelectorAll('[data-profile-sprite]').forEach(c=>{const okQ=!q||c.dataset.name.includes(q),okV=v==='all'||c.dataset.variant===v,okR=r==='all'||c.dataset.rarity===r,m=c.dataset.mastered==='1',okS=st==='all'||(st==='mastered'&&m)||(st==='unmastered'&&!m),show=okQ&&okV&&okR&&okS;c.classList.toggle('hidden',!show);if(show)shown++});if($('#profileCollectionCount'))$('#profileCollectionCount').textContent=shown};
  ['#profileCollectionSearch','#profileCollectionVariant','#profileCollectionRarity','#profileCollectionState'].forEach(sel=>{const el=$(sel);if(el)el[sel.includes('Search')?'oninput':'onchange']=applyProfileCollection});
  $('#shareProfileBtn')?.addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('id',id);url.searchParams.delete('rate');try{if(navigator.share)await navigator.share({title:`${name(p)} on SpriteSwap`,url:url.toString()});else{await navigator.clipboard.writeText(url.toString());$('#profileShareNote').textContent='Profile link copied.'}}catch{}});
  $('#pageRatingForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('ratings').upsert({rater_id:s.user.id,rated_id:id,trade_id:P.get('trade')||null,stars:+f.get('stars'),comment:f.get('comment')},{onConflict:'rater_id,rated_id'});$('#pageRatingNote').textContent=error?error.message:'Rating saved.';if(!error)setTimeout(()=>location.href=`/profile.html?id=${encodeURIComponent(id)}`,500)});
}

async function collectionPage(){header();await headerAuth();const s=await need();if(!s)return;const {data:inv}=await sb.from('sprite_inventory').select('*').eq('user_id',s.user.id),map=Object.fromEntries((inv||[]).map(r=>[r.sprite_id,r]));$('#collectionRoot').innerHTML=`<div class="page-topbar"><div class="page-title"><span class="icon-tile">${ico('grid')}</span><div><h1>My Collection</h1><p>Track every rarity and exact variant artwork.</p></div></div><a class="btn btn-secondary" href="/profile.html">View public profile</a></div><div class="collection-toolbar page-card"><input id="collectionSearch" type="search" placeholder="Search your Sprite index…"><select id="collectionVariant"><option value="all">All variants</option>${[...new Set(sprites.map(x=>x.variant))].map(v=>`<option>${esc(v)}</option>`).join('')}</select><select id="collectionState"><option value="all">All Sprites</option><option value="owned">Owned</option><option value="mastered">Mastered</option><option value="missing">Missing</option></select></div><div id="collectionGrid" class="profile-collection-grid collection-index-grid">${sprites.map(sp=>{const r=map[sp.id]||{};return `<article class="sprite-card ${esc(sp.rarity)} ${variantClass(sp.variant)}" data-collection-card data-name="${esc(sp.name.toLowerCase())}" data-variant="${esc(sp.variant)}" data-owned="${r.owned?'1':'0'}" data-mastered="${r.mastered?'1':'0'}"><div class="sprite-art"><span class="rarity-badge">${esc((sp.rarity||'rare').toUpperCase())}</span><span class="chance-badge">${esc(sp.chance||'0%')}</span><span class="variant-fx"></span><img src="${esc(sp.image)}" data-fallback="${esc(baseArt(sp))}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else this.src='assets/spriteswap-sprite-logo-128.png'"></div><div class="sprite-info"><div class="sprite-name-row"><b>${esc(sp.name)}</b><span class="variant-tag ${variantClass(sp.variant)}">${esc(sp.variant)}</span></div><div class="sprite-meta"><span>${esc(sp.rarity.toUpperCase())}</span><span>${esc(sp.chance||'0%')}</span></div><a class="sprite-detail-link" href="/sprite.html?id=${encodeURIComponent(sp.id)}">View full Sprite →</a><div class="collect-actions"><button class="collect-btn ${r.owned?'owned':''}" data-own="${esc(sp.id)}">${r.owned?'✓ OWNED':'+ OWN'}</button><button class="collect-btn ${r.mastered?'mastered':''}" data-master="${esc(sp.id)}">${r.mastered?'★ MASTERED':'☆ MASTER'}</button></div></div></article>`}).join('')}</div>`;const apply=()=>{const q=$('#collectionSearch').value.toLowerCase(),v=$('#collectionVariant').value,st=$('#collectionState').value;document.querySelectorAll('[data-collection-card]').forEach(c=>{const okQ=!q||c.dataset.name.includes(q),okV=v==='all'||c.dataset.variant===v,owned=c.dataset.owned==='1',mastered=c.dataset.mastered==='1',okS=st==='all'||(st==='owned'&&owned)||(st==='mastered'&&mastered)||(st==='missing'&&!owned);c.classList.toggle('hidden',!(okQ&&okV&&okS))})};$('#collectionSearch').oninput=apply;$('#collectionVariant').onchange=apply;$('#collectionState').onchange=apply;$('#collectionRoot').onclick=async e=>{const o=e.target.closest('[data-own]'),m=e.target.closest('[data-master]'),id=o?.dataset.own||m?.dataset.master;if(!id)return;const old=map[id]||{};let owned=!!old.owned,mastered=!!old.mastered;if(m){mastered=!mastered;if(mastered)owned=true}else{owned=!owned;if(!owned)mastered=false}const sp=sprite(id);if(!owned)await sb.from('sprite_inventory').delete().eq('user_id',s.user.id).eq('sprite_id',id);else await sb.from('sprite_inventory').upsert({user_id:s.user.id,sprite_id:id,owned,mastered,rarity:sp?.rarity||'rare'},{onConflict:'user_id,sprite_id'});location.reload()}}
async function tradePage(){
  header(); await headerAuth(); const s=await need(); if(!s)return;
  const me=await profile(s.user.id);
  const {data:invRows}=await sb.from('sprite_inventory').select('sprite_id,owned,mastered').eq('user_id',s.user.id);
  const ownedIds=new Set((invRows||[]).filter(r=>r.owned).map(r=>r.sprite_id));
  const byName=n=>sprites.find(sp=>sp.name.toLowerCase()===String(n||'').toLowerCase());
  const currentTradeSprites=()=>sprites.filter(sp=>sp.season!=='C7 S3');
  const currentTradeIds=new Set(currentTradeSprites().map(sp=>sp.id));
  // Trading rule: offered Sprites must be owned AND belong to Chapter 7 Season 4.
  // The wanted side remains limited to the current/new released catalog.
  const chapter7Season4Ids=new Set(sprites.filter(sp=>sp.season==='C7 S4').map(sp=>sp.id));
  const offerableOwnedIds=new Set([...ownedIds].filter(id=>chapter7Season4Ids.has(id)));
  const draftKey='spriteswap_trade_builder_v21';
  let draft={offer:[],want:[],note:''};
  try{draft={...draft,...JSON.parse(localStorage.getItem(draftKey)||'{}')}}catch{}
  let offer=Array.isArray(draft.offer)?draft.offer.filter(n=>byName(n)&&offerableOwnedIds.has(byName(n).id)).slice(0,8):[];
  let want=Array.isArray(draft.want)?draft.want.filter(n=>byName(n)&&currentTradeIds.has(byName(n).id)&&!byName(n).unreleased).slice(0,8):[];
  const preOffer=P.get('offer'),preWant=P.get('want');
  if(preOffer&&byName(preOffer)&&offerableOwnedIds.has(byName(preOffer).id)&&!offer.includes(byName(preOffer).name))offer.unshift(byName(preOffer).name);
  if(preWant&&byName(preWant)&&currentTradeIds.has(byName(preWant).id)&&!byName(preWant).unreleased&&!want.includes(byName(preWant).name))want.unshift(byName(preWant).name);
  let pickerSide='offer';
  const note=$('#tradeNote'); note.value=String(draft.note||'').slice(0,240);
  const variants=[...new Set(sprites.map(x=>x.variant||'Base'))].sort((a,b)=>a.localeCompare(b));
  $('#tradePickerVariant').innerHTML='<option value="all">All variants</option>'+variants.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  $('#tradePostingIdentity').innerHTML=`<img src="${esc(avatar(me))}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'" alt=""><div><b>${esc(name(me))}</b><span>You are posting this trade</span></div>`;

  const saveDraft=()=>{try{localStorage.setItem(draftKey,JSON.stringify({offer,want,note:note.value}))}catch{}};
  const sideArr=side=>side==='offer'?offer:want;
  const otherArr=side=>side==='offer'?want:offer;
  const variantTier=()=>{const vals=[...offer,...want].map(n=>byName(n)?.variant||'Base');const u=[...new Set(vals)];return u.length===1&&['Base','Gold','Cheat Master'].includes(u[0])?u[0]:'Any'};
  const overlap=()=>offer.filter(n=>want.includes(n));
  const allOffersOwned=()=>offer.every(n=>{const sp=byName(n);return sp&&offerableOwnedIds.has(sp.id)});
  const valid=()=>offer.length>0&&want.length>0&&!overlap().length&&allOffersOwned();
  const updateChecklist=()=>{
    const set=(sel,ok,label)=>{const el=$(sel);el.classList.toggle('valid',ok);el.classList.toggle('invalid',!ok);el.querySelector('i').textContent=ok?'✓':'○';if(label)el.querySelector('span').textContent=label};
    set('#checkOffer',offer.length>0,offer.length?`${offer.length} Sprite${offer.length===1?'':'s'} offered`:'At least one Sprite offered');
    set('#checkWant',want.length>0,want.length?`${want.length} Sprite${want.length===1?'':'s'} wanted`:'At least one Sprite wanted');
    set('#checkOverlap',!overlap().length,overlap().length?'Remove duplicate Sprites from both sides':'No Sprite on both sides');
    set('#checkOwned',allOffersOwned(),allOffersOwned()?'Every offered Sprite is in your vault':'An offered Sprite is not in your vault');
    $('#publishTradeBtn').disabled=!valid();
    $('#tradeSubmitHint').textContent=valid()?'Ready to post. Your trade will appear live immediately.':'Add at least one valid Sprite to each side.';
  };
  const pickCard=(sp,side)=>`<article class="trade-picked-sprite ${variantClass(sp.variant)}"><button type="button" class="trade-picked-remove" data-remove-side="${side}" data-remove-name="${esc(sp.name)}" aria-label="Remove ${esc(sp.name)}">×</button>${variantBadge(sp)}<div class="trade-picked-art"><span class="variant-fx"></span><img src="${esc(sp.image)}" data-fallback="${esc(baseArt(sp))}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else this.src='assets/spriteswap-sprite-logo-128.png'" alt="${esc(sp.name)}"></div><b>${esc(sp.name)}</b><small>${esc(sp.variant)} · ${esc(sp.rarity.toUpperCase())}</small></article>`;
  const emptyZone=side=>`<button type="button" class="trade-add-empty" data-open-picker="${side}"><span>＋</span><b>Add Sprites</b><small>up to 8</small></button>`;
  const renderZones=()=>{
    $('#offerCount').textContent=offer.length;$('#wantCount').textContent=want.length;
    $('#offerZone').innerHTML=offer.length?offer.map(n=>pickCard(byName(n),'offer')).join('')+(offer.length<8?`<button type="button" class="trade-add-mini" data-open-picker="offer">＋<span>Add</span></button>`:''):emptyZone('offer');
    $('#wantZone').innerHTML=want.length?want.map(n=>pickCard(byName(n),'want')).join('')+(want.length<8?`<button type="button" class="trade-add-mini" data-open-picker="want">＋<span>Add</span></button>`:''):emptyZone('want');
    updateChecklist();saveDraft();renderPicker();
  };
  const renderPicker=()=>{
    const panel=$('#spritePickerPanel'); if(panel.classList.contains('hidden'))return;
    const q=$('#tradePickerSearch').value.trim().toLowerCase(),v=$('#tradePickerVariant').value,r=$('#tradePickerRarity').value, selected=sideArr(pickerSide),other=otherArr(pickerSide);
    let rows=(pickerSide==='offer'?sprites:currentTradeSprites()).filter(sp=>pickerSide==='offer'?offerableOwnedIds.has(sp.id):!sp.unreleased);
    rows=rows.filter(sp=>(!q||`${sp.name} ${sp.base} ${sp.variant}`.toLowerCase().includes(q))&&(v==='all'||sp.variant===v)&&(r==='all'||sp.rarity===r));
    rows.sort((a,b)=>a.variant.localeCompare(b.variant)||a.name.localeCompare(b.name));
    $('#tradePickerGrid').innerHTML=rows.length?rows.map(sp=>{const chosen=selected.includes(sp.name),blocked=other.includes(sp.name),full=selected.length>=8&&!chosen;return `<button type="button" class="trade-picker-card ${variantClass(sp.variant)} ${chosen?'selected':''} ${blocked||full?'disabled':''}" data-pick-name="${esc(sp.name)}" ${blocked||full?'disabled':''}>${variantBadge(sp)}<span class="trade-picker-art"><span class="variant-fx"></span><img src="${esc(sp.image)}" data-fallback="${esc(baseArt(sp))}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else this.src='assets/spriteswap-sprite-logo-128.png'" alt=""></span><b>${esc(sp.name)}</b><small>${blocked?'Already on other side':chosen?'Selected':`${esc(sp.variant)} · ${esc(sp.rarity.toUpperCase())}`}</small><i>${chosen?'✓':'+'}</i></button>`}).join(''):'<div class="empty">No Sprites match these filters.</div>';
  };
  const openPicker=side=>{pickerSide=side;$('#spritePickerPanel').classList.remove('hidden');$('#pickerTitle').textContent=side==='offer'?"ADD SPRITES YOU'RE OFFERING":"ADD SPRITES YOU WANT";$('#pickerHelp').innerHTML=side==='offer'?`Showing <b>${offerableOwnedIds.size}</b> owned Chapter 7 Season 4 Sprites. <span class="current-season-note">Season 4 only.</span>`:'Current/new released Sprites only. <span class="current-season-note">Chapter 7 Season 3 is hidden.</span> Select up to 8.';$('#tradePickerSearch').value='';$('#tradePickerVariant').value='all';$('#tradePickerRarity').value='all';renderPicker();$('#spritePickerPanel').scrollIntoView({behavior:'smooth',block:'center'})};

  document.addEventListener('click',e=>{const op=e.target.closest('[data-open-picker]');if(op){openPicker(op.dataset.openPicker);return}const rm=e.target.closest('[data-remove-name]');if(rm){const arr=rm.dataset.removeSide==='offer'?offer:want,idx=arr.indexOf(rm.dataset.removeName);if(idx>=0)arr.splice(idx,1);renderZones();return}const pc=e.target.closest('[data-pick-name]');if(pc&&!pc.disabled){const arr=sideArr(pickerSide),n=pc.dataset.pickName,idx=arr.indexOf(n);if(idx>=0)arr.splice(idx,1);else if(arr.length<8&&!otherArr(pickerSide).includes(n))arr.push(n);renderZones()}});
  $('#closePicker').onclick=()=>$('#spritePickerPanel').classList.add('hidden');
  $('#tradePickerSearch').oninput=renderPicker;$('#tradePickerVariant').onchange=renderPicker;$('#tradePickerRarity').onchange=renderPicker;
  note.oninput=()=>{$('#tradeNoteCount').textContent=`${note.value.length} / 240`;saveDraft()};note.oninput();
  $('#newTradeForm').onsubmit=async e=>{
    e.preventDefault();if(!valid())return updateChecklist();
    const payload={user_id:s.user.id,offer:offer[0],want:want[0],offer_items:offer,want_items:want,tier:variantTier(),note:note.value.trim()};
    $('#publishTradeBtn').disabled=true;$('#formNote').textContent='Publishing trade…';
    const {error}=await sb.from('trades').insert(payload);
    if(error){$('#publishTradeBtn').disabled=false;$('#formNote').textContent=/offer_items|want_items|column/i.test(error.message)?'Run the V19 schema.sql in Supabase once, then try again.':error.message;return}
    try{localStorage.removeItem(draftKey)}catch{};$('#formNote').textContent='Trade published — taking you to the live board…';setTimeout(()=>location.href='/?#trades',550)
  };
  renderZones();
}
async function spritePage(){
  header(); await headerAuth();
  const id=P.get('id'),sp=sprite(id);
  if(!sp){$('#spriteRoot').innerHTML='<div class="empty">Sprite not found. It may have been renamed or removed from the live catalog.</div>';return}
  const s=await ses();
  let inv=null;
  if(s){const r=await sb.from('sprite_inventory').select('*').eq('user_id',s.user.id).eq('sprite_id',sp.id).maybeSingle();inv=r.data||null}
  const {data:tradeRows}=await sb.from('trades').select('*,trader:user_id(id,username,discord_name,avatar_url)').eq('status','open').order('created_at',{ascending:false}).limit(250);
  const exact=(tradeRows||[]).filter(t=>tradeItems(t,'offer').some(n=>n.toLowerCase()===sp.name.toLowerCase())||tradeItems(t,'want').some(n=>n.toLowerCase()===sp.name.toLowerCase())).slice(0,18);
  const tradeHtml=exact.length?exact.map(t=>{const os=tradeItems(t,'offer'),ws=tradeItems(t,'want'),gives=os.some(n=>n.toLowerCase()===sp.name.toLowerCase());return `<article class="sprite-trade-row"><div class="sprite-trade-main"><b>${esc(name(t.trader))} ${gives?'is offering':'is looking for'} ${esc(sp.name)}</b><span>${esc(os[0])}${os.length>1?` +${os.length-1}`:''} ↔ ${esc(ws[0])}${ws.length>1?` +${ws.length-1}`:''} · ${rel(t.created_at)}</span><div class="sprite-trade-badges"><i class="${gives?'good':'need'}">${gives?'YOU CAN GET THIS':'THEY NEED THIS'}</i><i>${os.length} FOR ${ws.length}</i></div></div><a class="btn btn-secondary btn-small" href="/messages.html?peer=${encodeURIComponent(t.user_id)}&trade=${encodeURIComponent(t.id)}">Open trade</a></article>`}).join(''):'<div class="empty">No open trades are using this exact Sprite yet.</div>';
  const source=sp.source_url||'https://fortnite.gg/sprites';
  $('#spriteRoot').innerHTML=`<div class="page-topbar"><div class="page-title"><span class="icon-tile">${ico('grid')}</span><div><h1>Sprite details</h1><p>Exact catalog art, rarity and live trade activity.</p></div></div><a class="btn btn-secondary" href="/#sprites">Back to Sprite Index</a></div>
    <div class="sprite-detail-shell">
      <section class="sprite-detail-art-card ${variantClass(sp.variant)}"><div class="sprite-detail-art"><span class="variant-fx"></span>${variantBadge(sp)}<img src="${esc(sp.image)}" data-fallback="${esc(baseArt(sp))}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else this.src='assets/spriteswap-sprite-logo-128.png'" alt="${esc(sp.name)}"></div><div class="sprite-detail-caption"><b>${esc(sp.name)}</b> · artwork synced from the public catalog.</div></section>
      <div class="sprite-detail-info">
        <section class="page-card sprite-detail-head"><h1>${esc(sp.name)}</h1><p>${esc(sp.base)} family · ${esc(sp.variant||'Base')} variant</p><div class="sprite-detail-tags"><span class="variant-summary-chip ${variantClass(sp.variant)}"><b>${esc(sp.variant||'Base')}</b></span><span class="mini-rarity-badge ${esc(sp.rarity||'rare')}" style="position:static">${esc((sp.rarity||'rare').toUpperCase())}</span>${sp.live_catalog?'<span class="tier">LIVE CATALOG</span>':''}</div><div class="sprite-detail-stat-grid"><article class="sprite-detail-stat"><span>DROP CHANCE</span><strong>${esc(sp.chance||'0%')}</strong></article><article class="sprite-detail-stat"><span>SEASON</span><strong>${esc(sp.season||'Latest')}</strong></article><article class="sprite-detail-stat"><span>VARIANT</span><strong>${esc(sp.variant||'Base')}</strong></article><article class="sprite-detail-stat"><span>RARITY</span><strong>${esc((sp.rarity||'rare').toUpperCase())}</strong></article></div><div class="sprite-detail-actions"><a class="btn btn-primary" href="/?q=${encodeURIComponent(sp.name)}#trades">Find live trades</a><a class="btn btn-secondary" href="/new-trade.html?offer=${encodeURIComponent(sp.name)}">I have this</a><a class="btn btn-secondary" href="/new-trade.html?want=${encodeURIComponent(sp.name)}">I want this</a><a class="btn btn-secondary" href="${esc(source)}" target="_blank" rel="noopener">Catalog source ↗</a></div>${s?`<div class="sprite-owned-state"><button class="collect-btn ${inv?.owned?'owned':''}" id="spriteOwnBtn">${inv?.owned?'✓ OWNED':'+ ADD TO VAULT'}</button><button class="collect-btn ${inv?.mastered?'mastered':''}" id="spriteMasterBtn">${inv?.mastered?'★ MASTERED':'☆ MASTER'}</button></div>`:'<p class="subtle" style="margin-top:14px">Sign in with Discord to add this Sprite to your vault.</p>'}</section>
        <section class="page-card sprite-trade-section"><h2>Live trades for ${esc(sp.name)}</h2><p>${exact.length} open ${exact.length===1?'trade':'trades'} found right now.</p><div class="sprite-trade-list">${tradeHtml}</div></section>
      </div>
    </div>`;
  const save=async(nextOwned,nextMastered)=>{if(!s)return;nextMastered=!!nextMastered;nextOwned=!!nextOwned||nextMastered;if(!nextOwned)await sb.from('sprite_inventory').delete().eq('user_id',s.user.id).eq('sprite_id',sp.id);else await sb.from('sprite_inventory').upsert({user_id:s.user.id,sprite_id:sp.id,owned:nextOwned,mastered:nextMastered,rarity:sp.rarity||'rare'},{onConflict:'user_id,sprite_id'});location.reload()};
  $('#spriteOwnBtn')?.addEventListener('click',()=>save(!inv?.owned,false));
  $('#spriteMasterBtn')?.addEventListener('click',()=>save(true,!inv?.mastered));
}


async function tradeDetailPage(){
  header(); await headerAuth();
  const id=P.get('id'); if(!id){$('#tradeDetailRoot').innerHTML='<div class="empty">Trade ID is missing.</div>';return}
  const session=await ses(),uid=session?.user.id||null;
  const tradeRes=await sb.from('trades').select('*,trader:user_id(id,username,discord_name,avatar_url,rating_avg,rating_count)').eq('id',id).maybeSingle();
  const t=tradeRes.data;
  if(tradeRes.error||!t){$('#tradeDetailRoot').innerHTML='<div class="empty"><b>Trade not found.</b><span>This listing may have been removed.</span><a class="btn btn-secondary" href="/#trades">Back to trade board</a></div>';return}

  let requests=[];
  if(session){
    const rr=await sb.from('trade_requests').select('*,requester:requester_id(id,username,discord_name,avatar_url,rating_avg,rating_count),owner:owner_id(id,username,discord_name,avatar_url,rating_avg,rating_count)').eq('trade_id',id).order('created_at',{ascending:false});
    if(rr.error){console.error(rr.error);pageToast('Run the V22 Supabase migration to enable trade requests.',true)}
    else requests=rr.data||[];
  }

  const offers=tradeItems(t,'offer'),wants=tradeItems(t,'want'),isMine=uid===t.user_id;
  const accepted=requests.find(r=>r.status==='accepted'||r.status==='completed')||null;
  const myRequest=!isMine&&uid?requests.find(r=>r.requester_id===uid)||null:null;
  const pending=isMine?requests.filter(r=>r.status==='pending'):[];

  let owned=new Set();
  if(session){const inv=await sb.from('sprite_inventory').select('sprite_id,owned').eq('user_id',uid).eq('owned',true);owned=new Set((inv.data||[]).map(r=>r.sprite_id))}
  const byName=n=>sprites.find(sp=>sp.name.toLowerCase()===String(n||'').toLowerCase());
  const ownedName=n=>{const sp=byName(n);return !!sp&&owned.has(sp.id)};
  const missing=offers.filter(n=>!ownedName(n)),giveable=wants.filter(ownedName),perfect=!!session&&!isMine&&missing.length>0&&giveable.length>0;

  const side=(names,label)=>`<section class="trade-detail-side"><div class="trade-detail-side-head"><span>${label}</span><b>${names.length} Sprite${names.length===1?'':'s'}</b></div><div class="trade-detail-sprite-grid">${names.map(n=>{const sp=byName(n);return `<a class="trade-detail-big-sprite ${sp?variantClass(sp.variant):''}" href="${sp?`/sprite.html?id=${encodeURIComponent(sp.id)}`:'#'}"><span class="variant-fx"></span>${sp?variantBadge(sp):''}<div class="trade-detail-big-art"><img src="${esc(sp?.image||'assets/spriteswap-sprite-logo-128.png')}" data-fallback="${esc(sp?baseArt(sp):'')}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else this.src='assets/spriteswap-sprite-logo-128.png'" alt="${esc(n)}"></div><strong>${esc(n)}</strong>${sp?`<small>${esc(sp.variant)} · ${esc((sp.rarity||'rare').toUpperCase())}</small>`:''}${session&&!isMine?`<i class="trade-detail-owned ${ownedName(n)?'yes':'no'}">${ownedName(n)?'IN YOUR VAULT':'MISSING'}</i>`:''}</a>`}).join('')}</div></section>`;

  const statusLabel=t.status==='active'?'ACCEPTED':t.status==='closed'?'COMPLETED':t.status==='removed'?'CANCELLED':'OPEN';
  const acceptedPeer=accepted?(isMine?accepted.requester:accepted.owner):null;
  const completeCount=accepted?(Number(accepted.owner_completed)+Number(accepted.requester_completed)):0;
  const viewerCompleted=accepted?(isMine?accepted.owner_completed:accepted.requester_completed):false;

  let actions='';
  if(!session) actions='<a class="btn btn-primary" href="/api/discord-login">Sign in with Discord to request</a>';
  else if(isMine){
    if(t.status==='open') actions='<button id="tradeCloseDetail" class="btn btn-secondary">Close listing</button>';
    else if(t.status==='active'&&accepted) actions=`<a class="btn btn-primary" href="/messages.html?peer=${encodeURIComponent(accepted.requester_id)}&trade=${encodeURIComponent(t.id)}">Open trade chat</a><button class="btn btn-secondary" id="completeTradeBtn">${viewerCompleted?'✓ You confirmed':`Mark completed (${completeCount}/2)`}</button><button id="tradeCloseDetail" class="btn btn-secondary">Cancel trade</button>`;
    else if(accepted?.status==='completed') actions=`<a class="btn btn-secondary" href="/messages.html?peer=${encodeURIComponent(accepted.requester_id)}&trade=${encodeURIComponent(t.id)}">View trade chat</a><a class="btn btn-primary" href="/profile.html?id=${encodeURIComponent(accepted.requester_id)}&rate=1&trade=${encodeURIComponent(t.id)}">Rate trader</a>`;
    else actions='<a class="btn btn-secondary" href="/#trades">Back to trade board</a>';
  }else{
    if(accepted&&accepted.requester_id===uid) actions=accepted.status==='completed'?`<a class="btn btn-secondary" href="/messages.html?peer=${encodeURIComponent(t.user_id)}&trade=${encodeURIComponent(t.id)}">View trade chat</a><a class="btn btn-primary" href="/profile.html?id=${encodeURIComponent(t.user_id)}&rate=1&trade=${encodeURIComponent(t.id)}">Rate trader</a>`:`<a class="btn btn-primary" href="/messages.html?peer=${encodeURIComponent(t.user_id)}&trade=${encodeURIComponent(t.id)}">Open trade chat</a><button class="btn btn-secondary" id="completeTradeBtn">${viewerCompleted?'✓ You confirmed':`Mark completed (${completeCount}/2)`}</button>`;
    else if(t.status!=='open') actions='<span class="trade-request-state unavailable">This trade is no longer accepting requests.</span>';
    else if(!myRequest||['declined','cancelled'].includes(myRequest.status)) actions=`<button class="btn btn-primary" id="requestTradeBtn">Request this trade</button><a class="btn btn-secondary" href="/report.html?user=${encodeURIComponent(t.user_id)}&trade=${encodeURIComponent(t.id)}">Report</a>`;
    else if(myRequest.status==='pending') actions=`<span class="trade-request-state pending">● Request pending — waiting for ${esc(name(t.trader))}</span><button class="btn btn-secondary" id="cancelRequestBtn">Cancel request</button>`;
    else actions='<span class="trade-request-state unavailable">This request is no longer active.</span>';
  }

  const requestPanel=isMine&&t.status==='open'?`<section class="trade-request-panel page-card"><div class="trade-request-panel-head"><div><span>TRADE REQUESTS</span><h3>${pending.length?`${pending.length} collector${pending.length===1?'':'s'} want this trade`:'Waiting for requests'}</h3></div><small>Accept one request to unlock a private trade chat.</small></div>${pending.length?`<div class="trade-request-list">${pending.map(r=>`<article class="trade-request-row"><div class="trade-request-person"><img src="${esc(avatar(r.requester))}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'"><div><a href="/profile.html?id=${encodeURIComponent(r.requester_id)}">${esc(name(r.requester))}</a><span>★ ${Number(r.requester?.rating_avg||0).toFixed(1)} · ${r.requester?.rating_count||0} ratings · ${rel(r.created_at)}</span></div></div><div class="trade-request-buttons"><button class="btn btn-secondary btn-small" data-decline-request="${r.id}">Decline</button><button class="btn btn-primary btn-small" data-accept-request="${r.id}">Accept trade</button></div></article>`).join('')}</div>`:'<div class="trade-request-empty"><b>No requests yet</b><span>Your listing is live. Requests will appear here.</span></div>'}</section>`:'';

  const acceptedBanner=accepted?`<section class="accepted-trade-banner"><span class="accepted-check">✓</span><div><b>${accepted.status==='completed'?'Trade completed':'Trade accepted'}</b><span>${esc(name(acceptedPeer))} ${accepted.status==='completed'?'completed this trade with you.':'is your trade partner. Chat is unlocked.'}</span></div><span class="completion-pill">${completeCount}/2 confirmed</span></section>`:'';

  const titleOffer=offers.length===1?offers[0]:`${offers[0]}${offers.length>1?` + ${offers.length-1} more`:''}`;
  const titleWant=wants.length===1?wants[0]:`${wants[0]}${wants.length>1?` + ${wants.length-1} more`:''}`;
  const tradeTitle=`${titleOffer} for ${titleWant}`;
  const offeredSprites=offers.map(byName).filter(Boolean);
  const rarest=offeredSprites.slice().sort((a,b)=>{const av=parseFloat(String(a.chance||'999').replace('%','')),bv=parseFloat(String(b.chance||'999').replace('%',''));return (Number.isFinite(av)?av:999)-(Number.isFinite(bv)?bv:999)})[0];
  const variantCount=new Set([...offers,...wants].map(byName).filter(Boolean).map(sp=>sp.variant)).size;

  $('#tradeDetailRoot').innerHTML=`
  <div class="trade-detail-nav"><a href="/#trades">‹ All trades</a><div><button id="shareTradeBtn" class="btn btn-secondary btn-small">Share</button>${!isMine?`<a class="btn btn-secondary btn-small" href="/report.html?user=${encodeURIComponent(t.user_id)}&trade=${encodeURIComponent(t.id)}">Report</a>`:''}</div></div>
  <div class="trade-detail-layout">
    <div class="trade-detail-main">
      <section class="page-card trade-detail-summary ${perfect?'perfect':''}">
        <div class="trade-detail-postline">◷ Posted <b data-live-age="${esc(t.created_at)}">${rel(t.created_at)}</b> by <a href="/profile.html?id=${encodeURIComponent(t.user_id)}">${esc(name(t.trader))}</a><code>#${esc(t.id.slice(0,10))}</code></div>
        <h1>${esc(tradeTitle)}</h1>
        <div class="trade-detail-summary-stats"><span><small>OFFERING</small><b>${offers.length} Sprite${offers.length===1?'':'s'}</b></span><span><small>WANTING</small><b>${wants.length} Sprite${wants.length===1?'':'s'}</b></span><span><small>RAREST OFFERED</small><b>${esc(rarest?`${String(rarest.rarity||'rare').toUpperCase()} · ${rarest.chance||'?'}`:'—')}</b></span><span><small>VARIANTS</small><b>${variantCount||1}</b></span><span><small>STATUS</small><b>${statusLabel}</b></span></div>
      </section>
      ${acceptedBanner}
      ${perfect&&t.status==='open'?`<div class="trade-detail-match-banner">⚡ <b>BEST MATCH FOR YOU</b><span>You need ${esc(missing[0])}${missing.length>1?` +${missing.length-1}`:''} and you have ${esc(giveable[0])}${giveable.length>1?` +${giveable.length-1}`:''}.</span></div>`:''}
      <section class="page-card trade-detail-exchange-shell"><div class="trade-detail-exchange">${side(offers,isMine?'YOU ARE OFFERING':'THEY ARE OFFERING')}<div class="trade-detail-swap">⇅</div>${side(wants,isMine?'YOU ARE LOOKING FOR':'THEY ARE LOOKING FOR')}</div></section>
      <section class="page-card trade-detail-description"><span>DESCRIPTION</span><p>${esc(t.note||'No description provided.')}</p></section>
      ${requestPanel}
    </div>
    <aside class="trade-detail-rail">
      <section class="page-card trade-rail-card"><div class="trade-rail-person"><img src="${esc(avatar(t.trader))}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'"><div><a href="/profile.html?id=${encodeURIComponent(t.user_id)}">${esc(name(t.trader))}</a><span>★ ${Number(t.trader?.rating_avg||0).toFixed(1)} · ${t.trader?.rating_count||0} ratings</span></div></div><div class="trade-rail-meta"><span><small>ACCOUNT</small><b>Discord verified</b></span><span><small>POSTED</small><b data-live-age="${esc(t.created_at)}">${rel(t.created_at)}</b></span></div><div class="trade-detail-actions trade-rail-actions">${actions}</div><a class="trade-rail-profile" href="/profile.html?id=${encodeURIComponent(t.user_id)}">View full profile →</a></section>
      <div class="trade-rail-safety"><span>✓ Chat unlocks only after a trade is accepted.</span><span>● Keep the in-game swap coordinated through trade chat.</span><span>★ Ratings unlock after both traders confirm completion.</span><span>⚑ Never share passwords, login codes, or payment details.</span></div>
      <div class="trade-rail-id"><small>TRADE ID</small><code>${esc(t.id)}</code></div>
    </aside>
  </div>`;
  document.querySelectorAll('[data-live-age]').forEach(el=>{el.textContent=rel(el.dataset.liveAge)});

  $('#shareTradeBtn')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:'SpriteSwap trade',url:location.href});else{await navigator.clipboard.writeText(location.href);pageToast('Trade link copied')}}catch{}});
  $('#requestTradeBtn')?.addEventListener('click',async()=>{const r=await sb.rpc('request_trade',{p_trade_id:id});if(r.error)return pageToast(r.error.message,true);pageToast('Trade request sent');setTimeout(()=>location.reload(),450)});
  $('#cancelRequestBtn')?.addEventListener('click',async()=>{const ok=await confirmAction({title:'Cancel trade request?',message:'The trader will no longer see your pending request.',confirmText:'Cancel request',danger:true});if(!ok)return;const r=await sb.rpc('cancel_trade_request',{p_request_id:myRequest.id});if(r.error)return pageToast(r.error.message,true);location.reload()});
  document.querySelectorAll('[data-accept-request]').forEach(b=>b.addEventListener('click',async()=>{const req=requests.find(r=>r.id===b.dataset.acceptRequest),ok=await acceptTradeWarning(name(req?.requester));if(!ok)return;const r=await sb.rpc('respond_trade_request',{p_request_id:b.dataset.acceptRequest,p_decision:'accepted'});if(r.error)return pageToast(r.error.message,true);pageToast('Trade accepted — private chat unlocked');setTimeout(()=>location.href=`/messages.html?peer=${encodeURIComponent(req?.requester_id||'')}&trade=${encodeURIComponent(id)}`,600)}));
  document.querySelectorAll('[data-decline-request]').forEach(b=>b.addEventListener('click',async()=>{const r=await sb.rpc('respond_trade_request',{p_request_id:b.dataset.declineRequest,p_decision:'declined'});if(r.error)return pageToast(r.error.message,true);location.reload()}));
  $('#completeTradeBtn')?.addEventListener('click',async()=>{if(!accepted||viewerCompleted)return;const r=await sb.rpc('confirm_trade_complete',{p_request_id:accepted.id});if(r.error)return pageToast(r.error.message,true);pageToast(r.data?'Trade completed — both traders confirmed':'Marked complete — waiting for the other trader');setTimeout(()=>location.reload(),550)});
  $('#tradeCloseDetail')?.addEventListener('click',async()=>{const active=t.status==='active',ok=await confirmAction({title:active?'Cancel accepted trade?':'Close this listing?',message:active?'This ends the accepted trade and disables the trade chat.':'The listing will disappear from the live trade board.',confirmText:active?'Cancel trade':'Close listing',danger:true});if(!ok)return;const r=active?await sb.rpc('cancel_accepted_trade',{p_trade_id:id}):await sb.from('trades').update({status:'closed'}).eq('id',id);if(r.error)return pageToast(r.error.message,true);pageToast(active?'Accepted trade cancelled':'Listing closed');setTimeout(()=>location.reload(),450)});
}
async function messagesPage(){
  header(); await headerAuth(); const s=await need(); if(!s)return;
  const uid=s.user.id;
  const reqRes=await sb.from('trade_requests').select('*,requester:requester_id(id,username,discord_name,avatar_url,rating_avg,rating_count),owner:owner_id(id,username,discord_name,avatar_url,rating_avg,rating_count)').or(`owner_id.eq.${uid},requester_id.eq.${uid}`).in('status',['accepted','completed']).order('updated_at',{ascending:false}).limit(300);
  if(reqRes.error){$('#conversationList').innerHTML='<div class="message-list-empty">Run the V22 Supabase migration to enable accepted trade chats.</div>';console.error(reqRes.error);return}
  const requests=reqRes.data||[];
  const msgRes=await sb.from('messages').select('*').or(`sender_id.eq.${uid},recipient_id.eq.${uid}`).order('created_at',{ascending:true}).limit(1200);
  const ms=msgRes.data||[],tids=[...new Set(requests.map(r=>r.trade_id))];
  let trades=[];if(tids.length)trades=(await sb.from('trades').select('*').in('id',tids)).data||[];
  const conv=requests.map(r=>{const ownerView=r.owner_id===uid,peer=ownerView?r.requester_id:r.owner_id,p=ownerView?r.requester:r.owner,rows=ms.filter(m=>m.trade_id===r.trade_id&&((m.sender_id===uid&&m.recipient_id===peer)||(m.sender_id===peer&&m.recipient_id===uid))),unread=rows.filter(m=>m.recipient_id===uid&&!m.read_at).length;return{request:r,peer,trade:r.trade_id,p,rows,unread,lastAt:rows.at(-1)?.created_at||r.accepted_at||r.updated_at||r.created_at}}).sort((a,b)=>new Date(b.lastAt)-new Date(a.lastAt));
  let active=conv.find(c=>c.peer===P.get('peer')&&String(c.trade)===String(P.get('trade')||''))||conv[0]||null,filter='all',query='';
  const tradeFor=c=>trades.find(t=>t.id===c?.trade)||null,statusFor=c=>(c.request.status==='completed'||tradeFor(c)?.status==='closed')?'closed':'active';
  const filtered=()=>conv.filter(c=>{const st=statusFor(c);if(filter==='unread'&&!c.unread)return false;if(filter==='active'&&st!=='active')return false;if(filter==='closed'&&st!=='closed')return false;const q=query.trim().toLowerCase();return !q||name(c.p).toLowerCase().includes(q)||String(c.rows.at(-1)?.body||'').toLowerCase().includes(q)});
  async function markRead(){if(!active)return;const ids=active.rows.filter(m=>m.recipient_id===uid&&!m.read_at).map(m=>m.id);if(ids.length){const now=new Date().toISOString();await sb.from('messages').update({read_at:now}).in('id',ids);active.rows.forEach(m=>{if(ids.includes(m.id))m.read_at=now});active.unread=0}}
  function spriteTile(n,label){const sp=sprites.find(x=>x.name.toLowerCase()===String(n).toLowerCase());return `<a class="accepted-chat-sprite ${sp?variantClass(sp.variant):''}" href="${sp?`/sprite.html?id=${encodeURIComponent(sp.id)}`:'#'}">${sp?variantBadge(sp):''}<div><img src="${esc(sp?.image||'assets/spriteswap-sprite-logo-128.png')}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'" alt="${esc(n)}"></div><b>${esc(n)}</b><small>${esc(label)}</small></a>`}
  function render(){
    const list=filtered();
    $('#conversationList').innerHTML=list.length?list.map(c=>{const st=statusFor(c),last=c.rows.at(-1);return `<button class="conversation ${c===active?'active':''}" data-k="${esc(c.peer)}::${esc(c.trade)}"><img class="conversation-avatar-img" src="${esc(avatar(c.p))}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'"><span class="conversation-main"><b class="conversation-name">${esc(name(c.p))}${c.unread?` <i class="conversation-unread">${c.unread}</i>`:''}</b><small class="conversation-preview">${esc(last?.body||'Trade accepted — chat is ready.')}</small><time>${rel(last?.created_at||c.request.accepted_at||c.request.created_at)}</time></span><span class="conversation-status ${st}">${st==='active'?'ACTIVE':'COMPLETED'}</span></button>`}).join(''):`<div class="messages-zero"><div class="messages-zero-icon">↔</div><b>${conv.length?'No chats match this filter':'No accepted trades yet'}</b><span>${conv.length?'Try a different filter or search.':'Request a trade, or accept a request on one of your listings. Chat unlocks only after acceptance.'}</span><a class="btn btn-primary btn-small" href="/#trades">Browse live trades</a></div>`;
    if(!active){$('#messagesChatHead').innerHTML='<div><strong>Choose an accepted trade</strong><small>Your private trade chats appear here after acceptance.</small></div>';$('#pageThread').innerHTML='<div class="message-empty-state"><div class="message-lock-icon">✓</div><strong>Acceptance unlocks messaging</strong><span>No random DMs. Every chat stays attached to an accepted Sprite trade.</span></div>';$('#messagesTrade').innerHTML='<div class="trade-side-empty"><div><b>Trade details</b><p class="subtle">Select an accepted trade conversation.</p></div></div>';$('#pageMessageInput').disabled=true;return}
    const t=tradeFor(active),st=statusFor(active),req=active.request,confirmations=Number(req.owner_completed)+Number(req.requester_completed),viewerDone=req.owner_id===uid?req.owner_completed:req.requester_completed;
    $('#messagesChatHead').innerHTML=`<div class="chat-person"><img class="chat-avatar-img" src="${esc(avatar(active.p))}" onerror="this.src='assets/spriteswap-sprite-logo-128.png'"><span><strong>${esc(name(active.p))}</strong><small>Accepted trade · ${t?esc(t.id.slice(0,8)):'trade chat'}</small></span></div><div class="messages-head-actions"><span class="conversation-status ${st}">${st==='active'?'ACTIVE':'COMPLETED'}</span><a class="btn btn-secondary btn-small" href="/profile.html?id=${encodeURIComponent(active.peer)}">Profile</a></div>`;
    $('#pageThread').innerHTML=`<div class="accepted-system-message"><span>✓</span><div><b>Trade accepted</b><small>${fmt(req.accepted_at||req.updated_at||req.created_at)} · Coordinate the in-game swap here. Never share passwords or login codes.</small></div></div>${active.rows.length?active.rows.map(m=>`<div class="msg-row ${m.sender_id===uid?'mine':''}"><div class="msg ${m.sender_id===uid?'mine':''}">${esc(m.body)}<small>${fmt(m.created_at)}</small></div></div>`).join(''):'<div class="message-empty-state compact"><strong>Chat is unlocked</strong><span>Send the first message to coordinate when you’re both available.</span></div>'}`;
    $('#pageThread').scrollTop=$('#pageThread').scrollHeight;
    if(t){const os=tradeItems(t,'offer'),ws=tradeItems(t,'want'),ownerView=t.user_id===uid;$('#messagesTrade').innerHTML=`<div class="trade-side-head"><div><strong>Trade details</strong><small>#${esc(t.id.slice(0,10))}</small></div><span class="conversation-status ${st}">${st==='active'?'ACCEPTED':'COMPLETED'}</span></div><div class="accepted-chat-side"><label>${ownerView?'YOU OFFER':'THEY OFFER'} · ${os.length}</label><div class="accepted-chat-grid">${os.map(n=>spriteTile(n,'OFFER')).join('')}</div></div><div class="trade-swap-arrow">⇅</div><div class="accepted-chat-side"><label>${ownerView?'YOU WANT':'THEY WANT'} · ${ws.length}</label><div class="accepted-chat-grid">${ws.map(n=>spriteTile(n,'WANT')).join('')}</div></div><div class="trade-description"><label>DESCRIPTION</label><p>${esc(t.note||'No description provided.')}</p></div><div class="trade-completion-card"><div><b>Trade completion</b><span>${confirmations}/2 traders confirmed</span></div><div class="completion-track"><i style="width:${confirmations*50}%"></i></div>${st==='active'?`<button id="messageCompleteTrade" class="trade-side-btn complete" ${viewerDone?'disabled':''}>${viewerDone?'✓ You confirmed':'✓ Mark completed'}</button>`:'<div class="trade-completed-stamp">✓ Both traders confirmed</div>'}</div><div class="trade-side-actions"><a class="trade-side-btn" href="/trade.html?id=${encodeURIComponent(t.id)}">View full trade</a><a class="trade-side-btn" href="/profile.html?id=${encodeURIComponent(active.peer)}">View trader profile</a><a class="trade-side-btn danger" href="/report.html?user=${encodeURIComponent(active.peer)}&trade=${encodeURIComponent(t.id)}">Report trader</a></div>`;$('#messageCompleteTrade')?.addEventListener('click',async()=>{const r=await sb.rpc('confirm_trade_complete',{p_request_id:req.id});if(r.error)return pageToast(r.error.message,true);pageToast(r.data?'Trade completed — both traders confirmed':'Marked complete — waiting for the other trader');setTimeout(()=>location.reload(),550)})}
    $('#pageMessageInput').disabled=false;$('#pageMessageInput').placeholder='Write a message…';
  }
  render();await markRead();
  $('#conversationList').onclick=async e=>{const b=e.target.closest('[data-k]');if(!b)return;const [peer,trade]=b.dataset.k.split('::');active=conv.find(c=>c.peer===peer&&String(c.trade)===trade)||null;await markRead();render()};
  $('#conversationSearch').oninput=e=>{query=e.target.value;render()};
  document.querySelectorAll('[data-page-message-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.pageMessageFilter;document.querySelectorAll('[data-page-message-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});
  $('#pageMessageForm').onsubmit=async e=>{e.preventDefault();if(!active||statusFor(active)!=='active')return;const input=$('#pageMessageInput'),body=input.value.trim();if(!body)return;const button=e.currentTarget.querySelector('button');button.disabled=true;const r=await sb.from('messages').insert({sender_id:uid,recipient_id:active.peer,trade_id:active.trade,body}).select().single();button.disabled=false;if(r.error)return pageToast(r.error.message,true);input.value='';if(!active.rows.some(m=>m.id===r.data.id))active.rows.push(r.data);active.lastAt=r.data.created_at;render()};

  const absorbMessage=async payload=>{
    const m=payload.new;if(!m||!(m.sender_id===uid||m.recipient_id===uid))return;
    const peer=m.sender_id===uid?m.recipient_id:m.sender_id,c=conv.find(x=>x.peer===peer&&x.trade===m.trade_id);if(!c)return;
    if(!c.rows.some(x=>x.id===m.id))c.rows.push(m);c.lastAt=m.created_at;if(m.recipient_id===uid&&c!==active)c.unread++;
    conv.sort((a,b)=>new Date(b.lastAt)-new Date(a.lastAt));render();if(c===active&&m.recipient_id===uid)await markRead();
  };
  const live=sb.channel(`trade-chat-${uid}-${Date.now()}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`recipient_id=eq.${uid}`},absorbMessage)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`sender_id=eq.${uid}`},absorbMessage)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'trade_requests',filter:`owner_id=eq.${uid}`},()=>setTimeout(()=>location.reload(),250))
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'trade_requests',filter:`requester_id=eq.${uid}`},()=>setTimeout(()=>location.reload(),250))
    .subscribe();
  window.addEventListener('beforeunload',()=>{try{sb.removeChannel(live)}catch{}},{once:true});
}
async function notificationsPage(){
  header();await headerAuth();const s=await need();if(!s)return;
  const uid=s.user.id;
  const [{data:ms},{data:inv},{data:trades},{data:reqs}]=await Promise.all([
    sb.from('messages').select('*,sender:sender_id(username,discord_name,avatar_url)').eq('recipient_id',uid).is('read_at',null).order('created_at',{ascending:false}).limit(50),
    sb.from('sprite_inventory').select('sprite_id,owned').eq('user_id',uid).eq('owned',true),
    sb.from('trades').select('*,trader:user_id(username,discord_name,avatar_url)').eq('status','open').neq('user_id',uid).order('created_at',{ascending:false}).limit(150),
    sb.from('trade_requests').select('*,requester:requester_id(username,discord_name,avatar_url),owner:owner_id(username,discord_name,avatar_url),trade:trade_id(id,offer,offer_items,want,want_items,status)').or(`owner_id.eq.${uid},requester_id.eq.${uid}`).order('updated_at',{ascending:false}).limit(100)
  ]);
  const acceptedIds=new Set((reqs||[]).filter(r=>['accepted','completed'].includes(r.status)).map(r=>r.trade_id));
  const validMessages=(ms||[]).filter(m=>m.trade_id&&acceptedIds.has(m.trade_id));
  const ownedNames=new Set((inv||[]).map(r=>sprite(r.sprite_id)?.name.toLowerCase()).filter(Boolean));
  const matches=(trades||[]).filter(t=>tradeItems(t,'want').some(n=>ownedNames.has(n.toLowerCase()))).slice(0,20);
  const requestRows=(reqs||[]).filter(r=>r.owner_id===uid&&r.status==='pending').map(r=>({type:'request',when:r.created_at,html:`<a class="notification-row request" href="/trade.html?id=${encodeURIComponent(r.trade_id)}"><span class="icon-tile">↔</span><span><b>${esc(name(r.requester))} requested your trade</b><span>Review the request. Chat stays locked until you accept.</span></span><time>${rel(r.created_at)}</time></a>`}));
  const acceptedRows=(reqs||[]).filter(r=>r.requester_id===uid&&r.status==='accepted').map(r=>({type:'accepted',when:r.accepted_at||r.updated_at,html:`<a class="notification-row accepted" href="/messages.html?peer=${encodeURIComponent(r.owner_id)}&trade=${encodeURIComponent(r.trade_id)}"><span class="icon-tile">✓</span><span><b>${esc(name(r.owner))} accepted your trade request</b><span>Your private trade chat is unlocked.</span></span><time>${rel(r.accepted_at||r.updated_at)}</time></a>`}));
  const rows=[...requestRows,...acceptedRows,...validMessages.map(m=>({type:'message',when:m.created_at,html:`<a class="notification-row" href="/messages.html?peer=${encodeURIComponent(m.sender_id)}&trade=${encodeURIComponent(m.trade_id)}"><span class="icon-tile">${ico('msg')}</span><span><b>New trade message from ${esc(name(m.sender))}</b><span>${esc(m.body)}</span></span><time>${rel(m.created_at)}</time></a>`})),...matches.map(t=>{const give=tradeItems(t,'want').filter(n=>ownedNames.has(n.toLowerCase()));return {type:'match',when:t.created_at,html:`<a class="notification-row match" href="/trade.html?id=${encodeURIComponent(t.id)}"><span class="icon-tile">◎</span><span><b>${esc(name(t.trader))} wants something in your vault</b><span>You have ${esc(give[0]||tradeItems(t,'want')[0])}${give.length>1?` +${give.length-1}`:''}. Check the live trade.</span></span><time>${rel(t.created_at)}</time></a>`}})].sort((a,b)=>new Date(b.when)-new Date(a.when));
  $('#notificationRoot').innerHTML=`<div class="page-topbar"><div class="page-title"><span class="icon-tile">${ico('bell')}</span><div><h1>Notifications</h1><p>Trade requests, acceptances, messages, and vault matches.</p></div></div><a class="btn btn-secondary" href="/#trades">Browse trades</a></div><div class="notification-summary"><span><b>${requestRows.length}</b> pending requests</span><span><b>${acceptedRows.length}</b> accepted</span><span><b>${validMessages.length}</b> unread trade messages</span><span><b>${matches.length}</b> vault matches</span></div><div class="notifications-list">${rows.length?rows.map(x=>x.html).join(''):'<div class="page-card" style="padding:30px;text-align:center">You’re all caught up.</div>'}</div>`;
}
async function settingsPage(){header();await headerAuth();const s=await need();if(!s)return;const p=await profile(s.user.id);$('#settingsForm').bio.value=p?.bio||'';$('#settingsForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),{error}=await sb.from('profiles').update({bio:f.get('bio')}).eq('id',s.user.id);$('#settingsNote').textContent=error?error.message:'Saved.'}}

async function reportPage(){header();await headerAuth();const s=await need();if(!s)return;$('#reportPageForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),{error}=await sb.from('reports').insert({reporter_id:s.user.id,reported_user_id:P.get('user')||null,trade_id:P.get('trade')||null,reason:f.get('reason'),details:f.get('details')});$('#reportPageNote').textContent=error?error.message:'Report sent to moderators.';if(!error)e.target.reset()}}
async function adminPage(){header();await headerAuth();const s=await need();if(!s)return;const p=await profile(s.user.id);if(!p?.is_admin){$('#adminPageRoot').innerHTML='<div class="empty">Admin access required.</div>';return}const {data:rows}=await sb.from('reports').select('*,reporter:reporter_id(username,discord_name),reported:reported_user_id(username,discord_name)').order('created_at',{ascending:false}).limit(100);$('#adminPageRoot').innerHTML=(rows||[]).length?(rows||[]).map(r=>`<div class="admin-row"><div><b>${esc(r.reason)}</b> <span class="tier">${esc(r.status)}</span><div class="subtle">Reporter ${esc(name(r.reporter))} · Target ${esc(name(r.reported))}</div><p>${esc(r.details||'No details')}</p></div><div class="admin-actions"><button class="btn btn-secondary btn-small" data-status="${r.id}:reviewed">reviewed</button><button class="btn btn-secondary btn-small" data-status="${r.id}:dismissed">dismissed</button><button class="btn btn-danger btn-small" data-status="${r.id}:actioned">actioned</button></div></div>`).join(''):'<div class="empty">No reports.</div>';$('#adminPageRoot').onclick=async e=>{const b=e.target.closest('[data-status]');if(!b)return;const [id,status]=b.dataset.status.split(':');await sb.from('reports').update({status}).eq('id',id);location.reload()}}

document.addEventListener('DOMContentLoaded',async()=>{await loadLiveCatalog();const p=document.body.dataset.page;if(p==='profile')profilePage();if(p==='collection')collectionPage();if(p==='sprite')spritePage();if(p==='trade')tradeDetailPage();if(p==='messages')messagesPage();if(p==='new-trade')tradePage();if(p==='notifications')notificationsPage();if(p==='settings')settingsPage();if(p==='report')reportPage();if(p==='admin')adminPage()});
})();
