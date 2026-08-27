(() => {
  const cfg = window.SPRITESWAP_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.startsWith('YOUR_');
  const sb = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const state = { session:null, me:null, trades:[], profiles:[], ratings:[], messages:[], messageTrades:[], tradeRequests:[], inventories:[], activePeer:null, activeTradeId:null, messageFilter:'all', messageSearch:'', adminTab:'reports', collection: loadCollection() };
  const sprites = window.SPRITES || [];
  function loadCollection(){ try{return JSON.parse(localStorage.getItem('spriteswap-collection')||'{}')}catch{return {}} }
  function saveCollection(){ localStorage.setItem('spriteswap-collection',JSON.stringify(state.collection)); }
  const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = (v) => new Date(v).toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
  const relativeAge = (v) => { const ms=Math.max(0,Date.now()-new Date(v).getTime()), s=Math.floor(ms/1000); if(s<10)return 'just now'; if(s<60)return `${s}s ago`; const m=Math.floor(s/60); if(m<60)return `${m}m ago`; const h=Math.floor(m/60); if(h<24)return `${h}h ago`; const d=Math.floor(h/24); if(d<30)return `${d}d ago`; return fmt(v); };
  function refreshLiveAges(){ $$('[data-live-age]').forEach(el=>{ el.textContent=relativeAge(el.dataset.liveAge); }); }
  function updateCatalogTotals(){ const total=sprites.length; ['catalogTotalHero','catalogTotalOwned','catalogTotalMastered'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=total;}); }
  const toast = (msg, bad=false) => { const el=document.createElement('div'); el.textContent=msg; Object.assign(el.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:99,padding:'12px 16px',borderRadius:'12px',background:bad?'#7f2535':'#183c33',color:'#fff',boxShadow:'0 10px 30px #0008'}); document.body.appendChild(el); setTimeout(()=>el.remove(),3000); };

  function confirmAction({title='Are you sure?',message='',confirmText='Confirm',cancelText='Cancel',danger=false}={}){
    return new Promise(resolve=>{
      let d=document.getElementById('siteConfirmDialog');
      if(!d){d=document.createElement('dialog');d.id='siteConfirmDialog';d.className='site-confirm-dialog';d.innerHTML='<form method="dialog" class="site-confirm-card"><span class="site-confirm-icon">!</span><div class="site-confirm-copy"><h3 id="siteConfirmTitle"></h3><p id="siteConfirmMessage"></p></div><div class="site-confirm-actions"><button value="cancel" class="btn btn-secondary" id="siteConfirmCancel"></button><button value="confirm" class="btn" id="siteConfirmOkay"></button></div></form>';document.body.appendChild(d)}
      d.querySelector('#siteConfirmTitle').textContent=title;d.querySelector('#siteConfirmMessage').textContent=message;d.querySelector('#siteConfirmCancel').textContent=cancelText;const ok=d.querySelector('#siteConfirmOkay');ok.textContent=confirmText;ok.className=`btn ${danger?'btn-danger':'btn-primary'}`;
      const done=()=>{d.removeEventListener('close',done);resolve(d.returnValue==='confirm')};d.addEventListener('close',done);d.showModal();
    });
  }
  const requireAuth = () => { if (!state.session) { $('#authDialog').showModal(); return false; } if (state.me?.is_banned){ toast('This account is restricted.',true); return false;} return true; };
  const iconForSprite = (s) => s?.image || '';
  const variantStyle = (v='Base') => `variant-${String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
  const baseArtFor = (s) => sprites.find(x => x.base === s?.base && x.variant === 'Base' && x.image)?.image || 'assets/spriteswap-sprite-logo-128.png';
  function bindImageFallbacks(root=document){
    root.querySelectorAll?.('img[data-sprite-fallback]').forEach(img=>{
      if(img.dataset.fallbackBound) return;
      img.dataset.fallbackBound='1';
      img.addEventListener('error',()=>{
        const fallback=img.dataset.spriteFallback;
        if(fallback && img.src!==fallback){ img.src=fallback; img.dataset.spriteFallback='assets/spriteswap-sprite-logo-128.png'; }
        else img.src='assets/spriteswap-sprite-logo-128.png';
      });
    });
  }
  function animateMastered(id){
    requestAnimationFrame(()=>{
      const card=document.querySelector(`[data-sprite-id="${CSS.escape(id)}"]`);
      if(!card) return;
      card.classList.remove('master-flash');
      void card.offsetWidth;
      card.classList.add('master-flash');
      setTimeout(()=>card.classList.remove('master-flash'),900);
    });
  }


  async function loadLiveSpriteCatalog(){
    try{
      const res=await fetch('/api/sprites',{headers:{accept:'application/json'}});
      if(!res.ok) return;
      const payload=await res.json();
      const rows=Array.isArray(payload.sprites)?payload.sprites:[];
      const byId=new Map(sprites.map((s,i)=>[s.id,i]));
      let added=0;
      for(const row of rows){
        if(!row?.id||!row?.name||!row?.image) continue;
        const next={id:row.id,name:row.name,base:row.base||row.name,variant:row.variant||'Base',rarity:row.rarity||'rare',chance:row.chance||'0%',season:row.season||'Latest',image:row.image,unreleased:!!row.unreleased,source_url:row.source_url||'',first_seen_at:row.first_seen_at||'',live_catalog:true};
        if(byId.has(next.id)) sprites[byId.get(next.id)]={...sprites[byId.get(next.id)],...next};
        else { byId.set(next.id,sprites.length); sprites.push(next); added++; }
      }
      if(rows.length){
        const season=$('#seasonFilter');
        if(season && ![...season.options].some(o=>o.value==='Latest')) season.insertAdjacentHTML('beforeend','<option value="Latest">Latest sync</option>');
      }
      if($('#spriteNames')) $('#spriteNames').innerHTML=sprites.map(s=>`<option value="${esc(s.name)}"></option>`).join('');
      updateCatalogTotals();
      const sync=$('#spriteSyncStatus');
      if(sync) sync.textContent=added?`${added} new Sprite${added===1?'':'s'} synced from Fortnite.GG`:'Live catalog synced with Fortnite.GG';
    }catch(err){ console.warn('live Sprite catalog unavailable',err); }
  }

  if (!configured) $('#setupBanner').classList.remove('hidden');

  async function boot(){
    bindUI();
    updateCatalogTotals();
    await loadLiveSpriteCatalog();
    setInterval(refreshLiveAges,30000);
    const imageObserver=new MutationObserver(()=>bindImageFallbacks(document)); imageObserver.observe(document.body,{childList:true,subtree:true}); bindImageFallbacks(document);
    const params=new URLSearchParams(location.search); if(params.get('discord_error')){toast(`Discord login: ${params.get('discord_error')}`,true); history.replaceState({},'',location.pathname);}
    if (!sb) return;
    const {data:{session}} = await sb.auth.getSession();
    state.session=session; await refreshAll(); updateAuthUI(); subscribeRealtime();
    sb.auth.onAuthStateChange(async (_event, session)=>{ state.session=session; await refreshAll(); updateAuthUI(); });
  }

  async function refreshAll(){
    if(!sb) return;
    const [tr,pf,ra,iv] = await Promise.all([
      sb.from('trades').select('*, profiles:user_id(id,username,discord_name,avatar_url,rating_avg,rating_count,is_banned)').eq('status','open').order('created_at',{ascending:false}),
      sb.from('profiles').select('id,username,bio,discord_name,avatar_url,rating_avg,rating_count,is_admin,is_banned,created_at').eq('is_banned',false).order('created_at',{ascending:false}).limit(100),
      sb.from('ratings').select('id').limit(1000),
      sb.from('sprite_inventory').select('user_id,sprite_id,owned,mastered,rarity').eq('owned',true).limit(10000)
    ]);
    state.trades=tr.data||[]; state.profiles=pf.data||[]; state.ratings=ra.data||[]; state.inventories=iv.data||[];
    if(state.session){
      const uid=state.session.user.id;
      const [{data:me},{data:reqs}] = await Promise.all([
        sb.from('profiles').select('*').eq('id',uid).single(),
        sb.from('trade_requests').select('*,requester:requester_id(id,username,discord_name,avatar_url),owner:owner_id(id,username,discord_name,avatar_url),trade:trade_id(id,user_id,offer,offer_items,want,want_items,status)').or(`owner_id.eq.${uid},requester_id.eq.${uid}`).order('updated_at',{ascending:false}).limit(250)
      ]);
      state.me=me||null; state.tradeRequests=reqs||[];
      await syncCollectionFromCloud(); await loadMessages();
    } else { state.me=null; state.messages=[]; state.tradeRequests=[]; }
    renderAll();
  }

  async function syncCollectionFromCloud(){
    if(!state.session) return;
    const uid=state.session.user.id;
    let mine=state.inventories.filter(r=>r.user_id===uid);
    const localRows=Object.entries(state.collection).filter(([,v])=>v?.owned).map(([sprite_id,v])=>{
      const sp=sprites.find(s=>s.id===sprite_id); return {user_id:uid,sprite_id,owned:true,mastered:!!v.mastered,rarity:sp?.rarity||'rare'};
    });
    if(!mine.length && localRows.length){
      const {data,error}=await sb.from('sprite_inventory').upsert(localRows,{onConflict:'user_id,sprite_id'}).select();
      if(!error){ state.inventories.push(...(data||[])); mine=data||localRows; toast(`Synced ${localRows.length} vault items to your profile ⚡`); }
    }
    if(mine.length){
      state.collection={}; mine.forEach(r=>state.collection[r.sprite_id]={owned:!!r.owned,mastered:!!r.mastered}); saveCollection();
    }
  }

  function renderAll(){ renderSprites(); renderTrades(); renderMembers(); renderStats(); updateAuthUI(); }
  function renderStats(){ $('#tradeCount').textContent=state.trades.length; $('#memberCount').textContent=state.profiles.length; $('#ratingCount').textContent=state.ratings.length; }

  const rarityWeight={mythic:5,legendary:4,epic:3,rare:2,special:1};
  function chanceNum(v){ const n=parseFloat(String(v).replace('%','')); return Number.isFinite(n)?n:999; }
  function renderSprites(){
    if(!$('#spriteGrid')) return;
    const q=$('#spriteSearch').value.trim().toLowerCase(), season=$('#seasonFilter').value, rarity=$('#rarityFilter').value, variant=$('#variantFilter').value, sort=$('#spriteSort').value;
    let rows=sprites.filter(s=>(!q||`${s.name} ${s.base} ${s.variant} ${s.rarity}`.toLowerCase().includes(q))&&(season==='all'||s.season===season)&&(rarity==='all'||s.rarity===rarity)&&(variant==='all'||s.variant===variant));
    rows.sort((a,b)=> sort==='name'?a.name.localeCompare(b.name): sort==='chance'?chanceNum(a.chance)-chanceNum(b.chance):(rarityWeight[b.rarity]-rarityWeight[a.rarity]||chanceNum(a.chance)-chanceNum(b.chance)||a.name.localeCompare(b.name)));
    $('#spriteResultCount').textContent=rows.length;
    $('#spriteGrid').innerHTML=rows.length?rows.map(s=>{const c=state.collection[s.id]||{}, liveNew=s.live_catalog&&(!s.first_seen_at||Date.now()-new Date(s.first_seen_at).getTime()<7*86400000);return `<article class="sprite-card ${s.rarity} ${s.unreleased?'unreleased':''} ${variantStyle(s.variant)}" data-sprite-id="${esc(s.id)}" data-variant="${esc(s.variant)}"><div class="sprite-art"><span class="rarity-badge">${esc(s.rarity)}</span><span class="chance-badge">${esc(s.chance)}</span>${liveNew?'<span class=\"live-catalog-pill\">NEW · LIVE SYNC</span>':''}<span class="variant-fx"></span><img loading="lazy" src="${esc(iconForSprite(s))}" data-sprite-fallback="${esc(baseArtFor(s))}" alt="${esc(s.base)} Sprite" referrerpolicy="no-referrer">${s.unreleased?'<span class=\"unreleased-pill\">UNRELEASED</span>':''}</div><div class="sprite-info"><div class="sprite-name-row"><div class="sprite-name" title="${esc(s.name)}">${esc(s.name)}</div><span class="variant-tag">${esc(s.variant)}</span></div><div class="sprite-meta"><span>${esc(s.season)}</span><span>${s.rarity==='special'?'SPECIAL VARIANT':esc(s.rarity).toUpperCase()}</span></div><a class="sprite-detail-link" href="/sprite.html?id=${encodeURIComponent(s.id)}">View full Sprite →</a><div class="collect-actions"><button type="button" class="collect-btn ${c.owned?'owned':''}" data-own-sprite="${s.id}">${c.owned?'✓ OWNED':'+ OWN'}</button><button type="button" class="collect-btn ${c.mastered?'mastered':''}" data-master-sprite="${s.id}">${c.mastered?'★ MASTERED':'☆ MASTER'}</button></div></div></article>`}).join(''):'<div class="empty">No sprites match those filters.</div>';
    updateCollectionStats(); bindImageFallbacks($('#spriteGrid'));
  }
  function updateCollectionStats(){ const owned=sprites.filter(s=>state.collection[s.id]?.owned).length, mastered=sprites.filter(s=>state.collection[s.id]?.mastered).length, total=sprites.length||1; updateCatalogTotals(); if($('#ownedCount'))$('#ownedCount').textContent=owned;if($('#masteredCount'))$('#masteredCount').textContent=mastered;if($('#ownedBar'))$('#ownedBar').style.width=`${owned/total*100}%`;if($('#masteredBar'))$('#masteredBar').style.width=`${mastered/total*100}%`; }
  function burst(el,kind='owned'){ const r=el.getBoundingClientRect(); const colors=kind==='mastered'?['#ffd447','#ff8a3d','#ff4fc8','#fff']:['#32e6ff','#9b5cff','#45f0a8','#fff']; for(let i=0;i<18;i++){const p=document.createElement('i');p.className='confetti';p.style.left=`${r.left+r.width/2}px`;p.style.top=`${r.top+r.height/2}px`;p.style.background=colors[i%colors.length];p.style.setProperty('--x',`${(Math.random()-.5)*190}px`);p.style.setProperty('--y',`${-30-Math.random()*160}px`);document.body.appendChild(p);setTimeout(()=>p.remove(),900);} }
  async function toggleSprite(id,type,el){
    const c=state.collection[id]||(state.collection[id]={owned:false,mastered:false});
    if(type==='mastered'){c.mastered=!c.mastered;if(c.mastered)c.owned=true;}else{c.owned=!c.owned;if(!c.owned)c.mastered=false;}
    saveCollection();
    const sp=sprites.find(s=>s.id===id);
    if(state.session && sb){
      if(!c.owned) await sb.from('sprite_inventory').delete().eq('user_id',state.session.user.id).eq('sprite_id',id);
      else await sb.from('sprite_inventory').upsert({user_id:state.session.user.id,sprite_id:id,owned:true,mastered:!!c.mastered,rarity:sp?.rarity||'rare'},{onConflict:'user_id,sprite_id'});
      const existing=state.inventories.find(r=>r.user_id===state.session.user.id&&r.sprite_id===id);
      if(!c.owned) state.inventories=state.inventories.filter(r=>!(r.user_id===state.session.user.id&&r.sprite_id===id));
      else if(existing){existing.owned=true;existing.mastered=!!c.mastered;existing.rarity=sp?.rarity||'rare';}
      else state.inventories.push({user_id:state.session.user.id,sprite_id:id,owned:true,mastered:!!c.mastered,rarity:sp?.rarity||'rare'});
    }
    const justActivated=!!c[type];
    renderSprites(); renderMembers();
    if(justActivated && type==='mastered') animateMastered(id);
    if(justActivated && type==='owned'){
      if(sp && (sp.rarity==='mythic' || chanceNum(sp.chance)<=0.15)) ultraRush(sp);
      else toast('Added to your vault! ⚡');
    }
  }

  function ultraRush(sp){
    document.querySelector('.ultra-rush')?.remove();
    const wrap=document.createElement('div'); wrap.className='ultra-rush';
    wrap.innerHTML=`<div class="ultra-rays"></div><div class="ultra-card ${esc(sp.rarity)} ${variantStyle(sp.variant)}" data-variant="${esc(sp.variant)}"><div class="ultra-kicker">⚡ ULTRA RARE ACQUIRED ⚡</div><img src="${esc(iconForSprite(sp))}" alt="${esc(sp.name)}"><h2>${esc(sp.name)}</h2><p>${esc(sp.rarity).toUpperCase()} · ${esc(sp.chance)} DROP CHANCE</p><div class="ultra-flex">+1 VAULT FLEX</div></div>`;
    document.body.appendChild(wrap); for(let i=0;i<4;i++) burst(wrap,'mastered');
    wrap.addEventListener('click',()=>wrap.remove()); setTimeout(()=>wrap.remove(),4200);
  }

  const spriteById=id=>sprites.find(s=>s.id===id);
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const tradeItems=(t,side)=>{const key=side==='offer'?'offer_items':'want_items',arr=Array.isArray(t?.[key])?t[key].filter(Boolean):[];return arr.length?arr:[String(t?.[side]||'').trim()].filter(Boolean);};
  const tradeNamesNorm=(t,side)=>tradeItems(t,side).map(norm);
  function inventoryFor(uid){ return state.inventories.filter(r=>r.user_id===uid&&r.owned); }
  function ownedNameSet(uid){ return new Set(inventoryFor(uid).flatMap(r=>{const s=spriteById(r.sprite_id);return s?[norm(s.name)]:[];})); }
  function flexFor(uid){
    const rows=inventoryFor(uid), counts={mythic:0,legendary:0,epic:0,rare:0,special:0}, mastered=rows.filter(r=>r.mastered).length;
    rows.forEach(r=>counts[r.rarity]=(counts[r.rarity]||0)+1);
    const top=counts.mythic?'MYTHIC HUNTER':counts.legendary?'LEGEND FLEX':counts.epic>=5?'EPIC STACKER':rows.length>=50?'VAULT 50+':'COLLECTOR';
    return {rows,counts,mastered,top};
  }
  function matchFor(uid){
    if(!state.session || uid===state.session.user.id) return null;
    const mine=ownedNameSet(state.session.user.id), wants=[...new Set(state.trades.filter(t=>t.user_id===uid).flatMap(t=>tradeNamesNorm(t,'want')).filter(Boolean))];
    const have=wants.filter(w=>mine.has(w)).length, pct=wants.length?Math.round(have/wants.length*100):0;
    return {have,total:wants.length,pct};
  }

  function tradeCardSprite(name,label){
    const sp=spriteForTradeName(name);
    const image=sp?.image||'assets/spriteswap-sprite-logo-128.png';
    return `<div class="trade-sprite-box ${sp?esc(sp.rarity):''}"><span class="trade-sprite-label">${esc(label)}</span>${sp?`<a class="trade-sprite-detail" href="/sprite.html?id=${encodeURIComponent(sp.id)}" aria-label="View ${esc(sp.name)} details">`:''}<div class="trade-sprite-art"><img src="${esc(image)}" alt="${esc(name)}" onerror="this.onerror=null;this.src='assets/spriteswap-sprite-logo-128.png'"></div><strong>${esc(name)}</strong>${sp?`<small>${esc(sp.variant)} · ${esc(sp.rarity).toUpperCase()}</small></a>`:''}</div>`;
  }
  function tradeCardSprites(names,label){
    const list=(names||[]).filter(Boolean), shown=list.slice(0,4);
    return `<div class="trade-sprite-group"><span class="trade-sprite-group-label">${esc(label)} <b>${list.length}</b></span><div class="trade-sprite-group-grid">${shown.map(n=>{const sp=spriteForTradeName(n),image=sp?.image||'assets/spriteswap-sprite-logo-128.png';return `<a class="trade-mini-sprite ${sp?variantStyle(sp.variant):''}" href="${sp?`/sprite.html?id=${encodeURIComponent(sp.id)}`:'#'}" aria-label="View ${esc(n)}"><span class="variant-fx"></span><img src="${esc(image)}" alt="${esc(n)}" onerror="this.onerror=null;this.src='assets/spriteswap-sprite-logo-128.png'"><small>${esc(n)}</small>${sp?`<em>${esc(sp.variant||'Base')}</em>`:''}</a>`}).join('')}${list.length>4?`<span class="trade-mini-more">+${list.length-4}<small>more</small></span>`:''}</div></div>`;
  }
  function renderTrades(){
    const q=$('#tradeSearch')?.value.trim().toLowerCase()||'', tier=$('#tierFilter')?.value||'all';
    const matchFilter=$('#tradeMatchFilter')?.value||'all', sort=$('#tradeSort')?.value||'smart';
    const mine=state.session?ownedNameSet(state.session.user.id):new Set();
    let rows=state.trades.map(t=>{
      const offers=tradeItems(t,'offer'),wants=tradeItems(t,'want'),offerNorm=offers.map(norm),wantNorm=wants.map(norm);
      const isMine=!!state.session&&state.session.user.id===t.user_id;
      const otherUser=!isMine;
      const missingOffers=state.session&&otherUser?offers.filter((n,i)=>!mine.has(offerNorm[i])):[];
      const giveable=state.session&&otherUser?wants.filter((n,i)=>mine.has(wantNorm[i])):[];
      const needOffer=!!state.session&&otherUser&&missingOffers.length>0, canGive=!!state.session&&otherUser&&giveable.length>0;
      const perfect=needOffer&&canGive;
      const wantRatio=wants.length?giveable.length/wants.length:0, needRatio=offers.length?missingOffers.length/offers.length:0;
      const score=perfect?100:Math.round((wantRatio*55)+(needRatio*45));
      return {t,offers,wants,isMine,otherUser,missingOffers,giveable,needOffer,canGive,perfect,score};
    }).filter(x=>{
      const t=x.t,hay=`${x.offers.join(' ')} ${x.wants.join(' ')} ${t.note||''} ${t.profiles?.username||''} ${t.profiles?.discord_name||''}`.toLowerCase();
      if(q&&!hay.includes(q))return false;
      if(tier!=='all'&&t.tier!==tier)return false;
      if(matchFilter==='best'&&!x.perfect)return false;
      if(matchFilter==='need'&&!x.needOffer)return false;
      if(matchFilter==='can-give'&&!x.canGive)return false;
      if(matchFilter==='mine'&&!x.isMine)return false;
      return true;
    });
    rows.sort((a,b)=>{
      if(sort==='newest')return new Date(b.t.created_at)-new Date(a.t.created_at);
      if(sort==='oldest')return new Date(a.t.created_at)-new Date(b.t.created_at);
      if(sort==='offers')return b.offers.length-a.offers.length||new Date(b.t.created_at)-new Date(a.t.created_at);
      return (b.perfect-a.perfect)||(b.score-a.score)||new Date(b.t.created_at)-new Date(a.t.created_at);
    });
    if($('#tradeVisibleCount')) $('#tradeVisibleCount').textContent=rows.length;
    const perfectCount=rows.filter(x=>x.perfect).length;
    if($('#tradeMatchSummary')) $('#tradeMatchSummary').innerHTML=state.session?(perfectCount?`<b>${perfectCount}</b> best vault match${perfectCount===1?'':'es'} right now`:'No exact two-way vault matches in this view'):'Sign in to unlock vault matching';
    $('#tradeGrid').innerHTML=rows.length?rows.map(x=>{
      const {t,offers,wants,isMine,otherUser,missingOffers,giveable,needOffer,canGive,perfect,score}=x;
      const ageMs=Date.now()-new Date(t.created_at).getTime(),fresh=ageMs<10*60*1000;
      const who=t.profiles?.discord_name||t.profiles?.username||'collector',avatar=t.profiles?.avatar_url||'assets/spriteswap-sprite-logo-128.png';
      let intel='';
      if(isMine){
        intel=`<div class="trade-intel trade-owner-intel"><span class="trade-intel-badge owner">YOUR LISTING</span><span class="trade-intel-copy">${offers.length} offered · ${wants.length} wanted</span></div>`;
      }else if(!state.session){
        intel='<div class="trade-intel"><a class="trade-intel-badge neutral sign-in-match" href="/api/discord-login">SIGN IN TO SEE YOUR VAULT MATCH</a></div>';
      }else{
        intel=`<div class="trade-intel">${needOffer?`<span class="trade-intel-badge need">${missingOffers.length} YOU NEED</span>`:'<span class="trade-intel-badge owned">OFFERS ALREADY OWNED</span>'}${canGive?`<span class="trade-intel-badge can-give">YOU HAVE ${giveable.length} THEY WANT</span>`:'<span class="trade-intel-badge missing-want">YOU DON’T HAVE THEIR WANTS</span>'}${score?`<span class="trade-match-score">${score}% MATCH</span>`:''}</div>`;
      }
      return `<article class="trade-card ${perfect?'perfect-match':''} ${fresh?'fresh-trade':''} ${isMine?'my-trade-card':''}">
        ${perfect?'<div class="match-ribbon">⚡ BEST MATCH FOR YOU</div>':''}
        <div class="trade-card-head"><button class="user-link trader-chip" data-profile="${t.user_id}"><img class="inline-user-avatar" src="${esc(avatar)}" alt="" onerror="this.onerror=null;this.src='assets/spriteswap-sprite-logo-128.png'"><span><b>${esc(who)}</b><small>★ ${Number(t.profiles?.rating_avg||0).toFixed(1)} · ${t.profiles?.rating_count||0} ratings</small></span></button><div class="trade-live-meta"><span class="live-dot"></span><b>${isMine?'YOUR TRADE':'LIVE'}</b><small data-live-age="${esc(t.created_at)}">${relativeAge(t.created_at)}</small></div></div>
        <div class="trade-card-exchange multi">${tradeCardSprites(offers,isMine?'YOU OFFER':'THEY OFFER')}<div class="trade-exchange-icon">⇄</div>${tradeCardSprites(wants,isMine?'YOU WANT':'THEY WANT')}</div>
        ${intel}
        ${perfect?`<div class="match-callout">You need ${esc(missingOffers[0])}${missingOffers.length>1?` +${missingOffers.length-1}`:''}, and you already have ${esc(giveable[0])}${giveable.length>1?` +${giveable.length-1}`:''}. This is a strong exact-variant match.</div>`:''}
        <div class="trade-card-note"><span>⚡</span><div><b>DESCRIPTION</b><p>${esc(t.note||'Straight swap — no description provided.')}</p></div></div>
        <div class="trade-card-foot"><div class="trade-posted"><small>Posted</small><b data-live-age="${esc(t.created_at)}">${relativeAge(t.created_at)}</b></div><div class="trade-actions"><a class="btn btn-secondary btn-small" href="/trade.html?id=${encodeURIComponent(t.id)}">View trade</a>${otherUser?`<a class="btn btn-primary btn-small" href="/trade.html?id=${encodeURIComponent(t.id)}">Request trade</a>`:`<button class="btn btn-secondary btn-small" data-close-trade="${t.id}">Close listing</button>`}</div></div>
      </article>`;
    }).join(''):`<div class="empty trade-empty"><b>No trades match this view.</b><span>Try clearing a filter, or post the trade you want to see.</span><a class="btn btn-primary" href="/new-trade.html">Post a trade</a></div>`;
    refreshLiveAges();
  }

  function renderMembers(){
    const q=$('#memberSearch').value.trim().toLowerCase();
    const rows=state.profiles.filter(p=>!q||`${p.username} ${p.bio} ${p.discord_name}`.toLowerCase().includes(q));
    $('#memberGrid').innerHTML=rows.length?rows.map(p=>{
      const flex=flexFor(p.id), match=matchFor(p.id);
      return `<article class="member-card"><div class="member-top"><button class="user-link user-link-rich" data-profile="${p.id}">${p.avatar_url?`<img class="inline-user-avatar" src="${esc(p.avatar_url)}" alt="">`:''}<span>${esc(p.discord_name||p.username)}</span></button>${p.is_admin?'<span class="tier">MOD</span>':''}</div><div class="flex-line"><span class="flex-badge ${flex.counts.mythic?'mythic-flex':''}">${flex.top}</span><span class="vault-count">${flex.rows.length}/${sprites.length} owned</span></div>${match&&match.total?`<div class="match-meter"><div><b>${match.pct}% MATCH</b><span>you have ${match.have} they want</span></div><i><em style="width:${match.pct}%"></em></i></div>`:''}<div class="rating">★ ${Number(p.rating_avg||0).toFixed(1)} <span class="muted">(${p.rating_count||0})</span></div><p class="muted">${esc(p.bio||'No bio yet.')}</p><button class="btn btn-secondary btn-small" data-profile="${p.id}">View inventory</button></article>`;
    }).join(''):`<div class="empty">No collectors found.</div>`;
  }

  function buildNotifications(){
    if(!state.session) return [];
    const uid=state.session.user.id;
    const acceptedIds=new Set(state.tradeRequests.filter(r=>['accepted','completed'].includes(r.status)).map(r=>r.trade_id));
    const unread=state.messages.filter(m=>m.recipient_id===uid&&!m.read_at&&m.trade_id&&acceptedIds.has(m.trade_id)).slice(-6).reverse().map(m=>({kind:'message',title:'New trade message',text:`${m.sender?.discord_name||m.sender?.username||'A collector'} sent you a message.`,url:`/messages.html?peer=${encodeURIComponent(m.sender_id)}&trade=${encodeURIComponent(m.trade_id)}`}));
    const pending=state.tradeRequests.filter(r=>r.owner_id===uid&&r.status==='pending').slice(0,6).map(r=>({kind:'request',title:'New trade request',text:`${r.requester?.discord_name||r.requester?.username||'A collector'} wants to accept your listing.`,url:`/trade.html?id=${encodeURIComponent(r.trade_id)}`}));
    const accepted=state.tradeRequests.filter(r=>r.requester_id===uid&&r.status==='accepted').slice(0,4).map(r=>({kind:'accepted',title:'Trade accepted',text:`${r.owner?.discord_name||r.owner?.username||'The trader'} accepted your request. Chat is now unlocked.`,url:`/messages.html?peer=${encodeURIComponent(r.owner_id)}&trade=${encodeURIComponent(r.trade_id)}`}));
    const mine=ownedNameSet(uid);
    const matches=state.trades.filter(t=>t.user_id!==uid&&tradeNamesNorm(t,'want').some(n=>mine.has(n))).slice(0,5).map(t=>{const wanted=tradeItems(t,'want').filter(n=>mine.has(norm(n)));return {kind:'match',title:'Trade match',text:`${t.profiles?.discord_name||t.profiles?.username||'A collector'} wants ${wanted[0]||tradeItems(t,'want')[0]}${wanted.length>1?` +${wanted.length-1}`:''}, which is in your vault.`,url:`/trade.html?id=${encodeURIComponent(t.id)}`}});
    return [...pending,...accepted,...unread,...matches].slice(0,12);
  }
  function renderHeaderPanels(){
    const display=state.me?.discord_name||state.me?.username||'Discord User';
    const avatar=state.me?.avatar_url||'assets/spriteswap-sprite-logo-128.png';
    if($('#accountMenuIdentity')) $('#accountMenuIdentity').innerHTML=`<img src="${esc(avatar)}" alt=""><div><b>${esc(display)}</b><span>@${esc(state.me?.username||'collector')}</span></div>`;
    const notes=buildNotifications();
    if($('#notificationBadge')){$('#notificationBadge').textContent=notes.length;$('#notificationBadge').classList.toggle('hidden',!notes.length);}
    if($('#notificationsPanel')) $('#notificationsPanel').innerHTML=`<div class="popover-head"><b>Notifications</b><span>${notes.length} new</span></div>${notes.length?notes.map(n=>`<a class="notification-item" href="${esc(n.url||'/notifications.html')}"><i>${n.kind==='request'?'↔':n.kind==='accepted'?'✓':n.kind==='match'?'◎':'●'}</i><span><b>${esc(n.title)}</b><small>${esc(n.text)}</small></span></a>`).join(''):'<div class="popover-empty">You’re all caught up.</div>'}`;
  }
  function updateAuthUI(){
    const logged=!!state.session;
    if(logged){const display=state.me?.discord_name||state.me?.username||'Discord User'; const avatar=state.me?.avatar_url||'assets/spriteswap-sprite-logo-128.png'; $('#authBtn').innerHTML=`<img class="nav-user-avatar" src="${esc(avatar)}" alt=""><span>${esc(display)}</span><b class="account-chevron">⌄</b>`;}else{$('#authBtn').textContent='Discord Login';}
    $('#messagesBtn').classList.toggle('hidden',!logged); $('#notificationsBtn')?.classList.toggle('hidden',!logged); $('#adminBtn').classList.toggle('hidden',!state.me?.is_admin); $('#heroJoinBtn').classList.toggle('hidden',logged); if(!logged){$('#accountMenu')?.classList.add('hidden');$('#notificationsPanel')?.classList.add('hidden');} updateUnread(); renderHeaderPanels();
  }

  async function openProfile(id, ratingMode=false, tradeId=null){
    if(!sb) return toast('Connect Supabase first.',true);
    const [{data:p},{data:rs},{data:inv},{data:userTrades}] = await Promise.all([
      sb.from('profiles').select('*').eq('id',id).single(),
      sb.from('ratings').select('*, rater:rater_id(username,discord_name,avatar_url)').eq('rated_id',id).order('created_at',{ascending:false}).limit(8),
      sb.from('sprite_inventory').select('*').eq('user_id',id).eq('owned',true).order('mastered',{ascending:false}).limit(250),
      sb.from('trades').select('id,status').eq('user_id',id).limit(500)
    ]); if(!p) return;
    const owned=inv||[], items=owned.map(r=>({row:r,sprite:spriteById(r.sprite_id)})).filter(x=>x.sprite);
    const counts={mythic:0,legendary:0,epic:0,rare:0,special:0}; items.forEach(x=>counts[x.row.rarity]=(counts[x.row.rarity]||0)+1);
    const mastered=items.filter(x=>x.row.mastered).length, own=state.session?.user.id===id, match=matchFor(id), trades=userTrades||[];
    const completed=trades.filter(t=>t.status==='closed').length, open=trades.filter(t=>t.status==='open').length, pct=Math.round(items.length/Math.max(1,sprites.length)*100);
    const display=p.discord_name||p.username, avatar=p.avatar_url||'assets/spriteswap-sprite-logo-128.png';
    $('#profileTitle').textContent=display;
    $('#profileBody').innerHTML=`<section class="profile-cover"><div class="profile-identity"><div class="avatar profile-avatar-xl"><img src="${esc(avatar)}" alt="${esc(display)} avatar"></div><div><h3>${esc(display)} ${p.is_admin?'<span class="verified-dot">◆</span>':''}</h3><div class="profile-subline"><span class="rating">★ ${Number(p.rating_avg||0).toFixed(1)} (${p.rating_count||0})</span><span>• Joined ${new Date(p.created_at).toLocaleDateString([], {month:'short',year:'numeric'})}</span>${own?'<span class="online-now">● Your profile</span>':''}</div><div class="discord-linked">DISCORD · @${esc(p.username)}</div></div></div><div class="profile-cover-actions">${own?'<button class="btn btn-secondary btn-small" id="editProfile">Edit profile</button>':`<a class="btn btn-primary btn-small" href="/?q=${encodeURIComponent(display)}#trades">View live trades</a><button class="btn btn-secondary btn-small" data-report-user="${id}">Report</button>`}</div></section>
      ${own?'<div class="profile-preview-note">This is how other collectors see you.</div>':''}
      <div class="profile-stat-grid"><article><span>TRADES DONE</span><strong>${completed}</strong><small>${open} open right now</small></article><article><span>SPRITES INDEXED</span><strong>${items.length}<small> / ${sprites.length}</small></strong><small>${pct}% collected</small></article><article><span>MASTERED</span><strong>${mastered}</strong><small>${counts.mythic} mythic owned</small></article><article><span>RATING</span><strong>★ ${Number(p.rating_avg||0).toFixed(1)}</strong><small>${p.rating_count||0} reviews</small></article></div>
      ${match&&match.total?`<div class="profile-match"><strong>${match.pct}% TRADE MATCH</strong><span>You own ${match.have} of the ${match.total} Sprites ${esc(display)} currently wants.</span></div>`:''}
      <div class="profile-progress-card"><div><b>${items.length}</b> of ${sprites.length} sprites collected <span>${pct}%</span></div><i><em style="width:${pct}%"></em></i><div class="profile-progress-splits"><span>MYTHIC <b>${counts.mythic}</b></span><span>LEGENDARY <b>${counts.legendary}</b></span><span>EPIC <b>${counts.epic}</b></span><span>RARE <b>${counts.rare}</b></span></div></div>
      <div class="profile-section-tabs"><button class="active">Collection <b>${items.length}</b></button><button>Reviews <b>${p.rating_count||0}</b></button></div>
      <div class="profile-inventory-head"><div><h3>Collection</h3><p>${esc(p.bio||'No bio yet.')}</p></div><span>${mastered} mastered</span></div>
      <div class="profile-inventory">${items.length?items.slice(0,90).map(({row,sprite})=>`<div class="mini-sprite ${sprite.rarity} ${variantStyle(sprite.variant)} ${row.mastered?'mini-mastered':''}" title="${esc(sprite.name)}"><div class="mini-sprite-thumb"><span class="variant-fx"></span><img src="${esc(iconForSprite(sprite))}" data-sprite-fallback="${esc(baseArtFor(sprite))}" alt="${esc(sprite.name)}"></div><span>${esc(sprite.name)}</span>${row.mastered?'<b>★</b>':''}</div>`).join(''):'<div class="empty">No public Sprites collected yet.</div>'}</div>
      <div id="ratingEditor" class="${ratingMode?'':'hidden'}">${ratingForm(id,tradeId)}</div><div class="profile-reviews"><h3>Recent reviews</h3>${(rs||[]).length?(rs||[]).map(r=>`<div class="review-row"><div class="review-user">${r.rater?.avatar_url?`<img src="${esc(r.rater.avatar_url)}" alt="">`:''}<b>${esc(r.rater?.discord_name||r.rater?.username||'collector')}</b></div><span class="rating">${'★'.repeat(r.stars)}</span><p>${esc(r.comment||'No comment')}</p></div>`).join(''):'<p class="muted">No ratings yet.</p>'}</div>`;
    $('#profileDialog').showModal(); bindImageFallbacks($('#profileDialog'));
    $('#editProfile')?.addEventListener('click',()=>editProfile(p)); bindDynamic($('#profileDialog'));
  }

  function ratingForm(id,tradeId){ return `<form id="ratingForm"><input type="hidden" name="rated_id" value="${id}"><input type="hidden" name="trade_id" value="${tradeId||''}"><div class="rating-row">${[1,2,3,4,5].map(n=>`<button type="button" class="star-btn" data-stars="${n}">★</button>`).join('')}</div><input type="hidden" name="stars" value="5"><label>Comment<input name="comment" maxlength="160" placeholder="Good trade, quick response…"></label><button class="btn btn-primary btn-small">Submit rating</button></form>`; }

  function editProfile(p){
    $('#profileBody').innerHTML=`<form id="editProfileForm"><label>Username<input name="username" value="${esc(p.username)}" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required></label><label>Discord identity<input value="${esc(p.discord_name||'Connected Discord account')}" disabled></label><label>Bio<textarea name="bio" maxlength="240">${esc(p.bio||'')}</textarea></label><button class="btn btn-primary">Save profile</button></form>`;
    $('#editProfileForm').onsubmit=async e=>{ e.preventDefault(); const f=new FormData(e.target); const {error}=await sb.from('profiles').update({username:f.get('username'),bio:f.get('bio')}).eq('id',state.session.user.id); if(error)return toast(error.message,true); toast('Profile updated'); $('#profileDialog').close(); await refreshAll(); };
  }

  async function loadMessages(){
    if(!state.session) return;
    const uid=state.session.user.id;
    const {data}=await sb.from('messages').select('*, sender:sender_id(username,discord_name,avatar_url,rating_avg,rating_count), recipient:recipient_id(username,discord_name,avatar_url,rating_avg,rating_count)').or(`sender_id.eq.${uid},recipient_id.eq.${uid}`).order('created_at',{ascending:true}).limit(800);
    state.messages=data||[];
    const tradeIds=[...new Set(state.messages.map(m=>m.trade_id).filter(Boolean))];
    if(tradeIds.length){
      const {data:trades}=await sb.from('trades').select('*, profiles:user_id(id,username,discord_name,avatar_url,rating_avg,rating_count)').in('id',tradeIds);
      state.messageTrades=trades||[];
    } else state.messageTrades=[];
    updateUnread();
  }
  const convoKey=(peer,tradeId)=>`${peer}::${tradeId||'direct'}`;
  function tradeForMessage(id){ return state.messageTrades.find(t=>t.id===id)||state.trades.find(t=>t.id===id)||null; }
  function spriteForTradeName(name){ const n=norm(name); return sprites.find(s=>norm(s.name)===n)||sprites.find(s=>n&&norm(s.name).includes(n))||sprites.find(s=>n&&n.includes(norm(s.name)))||null; }
  function tradeSpriteTile(name,label){ const sp=spriteForTradeName(name); return `<div class="trade-detail-sprite ${sp?esc(sp.rarity):''} ${sp?variantStyle(sp.variant):''}">${sp?`<div class="trade-thumb"><span class="variant-fx"></span><img src="${esc(iconForSprite(sp))}" data-sprite-fallback="${esc(baseArtFor(sp))}" alt="${esc(sp.name)}"></div>`:'<div class="sprite-fallback">S</div>'}<span>${esc(name)}</span><small>${esc(label)}</small></div>`; }
  function tradeSpriteTiles(names,label){return `<div class="trade-detail-stack">${(names||[]).map(n=>tradeSpriteTile(n,label)).join('')}</div>`;}
  function conversations(){
    const uid=state.session?.user.id, map=new Map();
    state.messages.forEach(m=>{
      const peer=m.sender_id===uid?m.recipient_id:m.sender_id;
      const profile=m.sender_id===uid?m.recipient:m.sender;
      const key=convoKey(peer,m.trade_id);
      const current=map.get(key)||{key,peer,tradeId:m.trade_id||null,name:profile?.discord_name||profile?.username||'collector',avatar:profile?.avatar_url||'',last:m,unread:0};
      current.last=m;
      if(m.recipient_id===uid&&!m.read_at) current.unread++;
      map.set(key,current);
    });
    return [...map.values()].sort((a,b)=>new Date(b.last.created_at)-new Date(a.last.created_at));
  }
  function messageStatus(trade){
    if(!trade) return {key:'direct',label:'DIRECT'};
    if(trade.status==='open') return {key:'active',label:'ACTIVE'};
    if(trade.status==='closed') return {key:'closed',label:'COMPLETED'};
    return {key:'closed',label:'CANCELLED'};
  }
  function renderMessages(){
    const query=(state.messageSearch||'').trim().toLowerCase();
    const rows=conversations().filter(c=>{
      const st=messageStatus(tradeForMessage(c.tradeId));
      if(state.messageFilter==='unread'&&!c.unread)return false;
      if(state.messageFilter==='active'&&st.key!=='active')return false;
      if(state.messageFilter==='closed'&&st.key!=='closed')return false;
      return !query||c.name.toLowerCase().includes(query)||String(c.last.body||'').toLowerCase().includes(query);
    });
    $('#conversationList').innerHTML=rows.length?rows.map(c=>{
      const active=state.activePeer===c.peer&&String(state.activeTradeId||'')===String(c.tradeId||'');
      const st=messageStatus(tradeForMessage(c.tradeId));
      const initial=(c.name||'?').slice(0,1).toUpperCase();
      return `<button class="conversation ${active?'active':''}" data-peer="${c.peer}" data-conversation-trade="${c.tradeId||''}"><span class="conversation-avatar">${c.avatar?`<img src="${esc(c.avatar)}" alt="">`:esc(initial)}</span><span class="conversation-main"><span class="conversation-name">${esc(c.name)} ${c.unread?`<b class="conversation-unread">${c.unread}</b>`:''}</span><span class="conversation-preview">${esc(c.last.body||'Trade conversation')}</span><small>${fmt(c.last.created_at)}</small></span><span class="conversation-status ${st.key}">${st.label}</span></button>`;
    }).join(''):'<div class="message-list-empty">No conversations match this filter.</div>';
    renderThread();
    renderTradeDetails();
  }
  function renderThread(){
    const uid=state.session?.user.id;
    if(!state.activePeer){
      $('#messageChatHeader').innerHTML='<div><strong>Choose a trade chat</strong><span>Your trade conversations will show here.</span></div>';
      $('#messageTradeNotice').classList.add('hidden');
      $('#messageThread').innerHTML='<div class="message-empty-state"><b>💬</b><strong>Pick a conversation</strong><span>Coordinate the Sprite swap here and keep your account details private.</span></div>';
      return;
    }
    const rows=state.messages.filter(m=>{
      const participants=(m.sender_id===uid&&m.recipient_id===state.activePeer)||(m.sender_id===state.activePeer&&m.recipient_id===uid);
      const sameTrade=state.activeTradeId?m.trade_id===state.activeTradeId:!m.trade_id;
      return participants&&sameTrade;
    });
    const peer=state.profiles.find(p=>p.id===state.activePeer);
    const fallback=rows.find(Boolean);
    const fallbackProfile=fallback?(fallback.sender_id===uid?fallback.recipient:fallback.sender):null; const name=peer?.discord_name||peer?.username||fallbackProfile?.discord_name||fallbackProfile?.username||'collector'; const avatar=peer?.avatar_url||fallbackProfile?.avatar_url||'';
    const trade=tradeForMessage(state.activeTradeId);
    const st=messageStatus(trade);
    $('#messageChatHeader').innerHTML=`<div class="chat-person"><span class="chat-avatar">${avatar?`<img src="${esc(avatar)}" alt="">`:esc(name.slice(0,1).toUpperCase())}</span><span><strong>${esc(name)}</strong><small>★ ${Number(peer?.rating_avg||0).toFixed(1)} · ${peer?.rating_count||0} ratings</small></span></div><span class="conversation-status ${st.key}">${st.label}</span>`;
    if(trade){ const os=tradeItems(trade,'offer'),ws=tradeItems(trade,'want'); $('#messageTradeNotice').innerHTML=`Trade chat: <b>${esc(os[0])}${os.length>1?` +${os.length-1}`:''}</b> → <b>${esc(ws[0])}${ws.length>1?` +${ws.length-1}`:''}</b>. Coordinate the in-game swap here — never share passwords or login codes.`; $('#messageTradeNotice').classList.remove('hidden'); }
    else $('#messageTradeNotice').classList.add('hidden');
    $('#messageThread').innerHTML=rows.length?`<div class="thread-date-chip">TRADE CHAT</div>${rows.map(m=>`<div class="msg-row ${m.sender_id===uid?'mine':''}"><div class="msg ${m.sender_id===uid?'mine':''}">${esc(m.body)}<small>${fmt(m.created_at)}</small></div></div>`).join('')}`:'<div class="message-empty-state"><b>⚡</b><strong>Start the conversation</strong><span>Ask when they are available and confirm the Sprite names before swapping.</span></div>';
    $('#messageThread').scrollTop=$('#messageThread').scrollHeight;
    markRead();
  }
  function renderTradeDetails(){
    const panel=$('#messageTradePanel');
    if(!state.activePeer){panel.innerHTML='<div class="trade-side-empty"><b>Trade details</b><span>Select a trade conversation to see the offer.</span></div>';return;}
    const trade=tradeForMessage(state.activeTradeId), peer=state.profiles.find(p=>p.id===state.activePeer), name=peer?.discord_name||peer?.username||'collector', avatar=peer?.avatar_url||'';
    if(!trade){panel.innerHTML=`<div class="trade-side-head"><strong>Direct message</strong><span class="conversation-status direct">DIRECT</span></div><div class="direct-profile-card"><span class="chat-avatar large">${avatar?`<img src="${esc(avatar)}" alt="">`:esc(name.slice(0,1).toUpperCase())}</span><b>${esc(name)}</b><small>★ ${Number(peer?.rating_avg||0).toFixed(1)} · ${peer?.rating_count||0} ratings</small></div><button class="trade-side-btn" data-profile="${state.activePeer}">View trader profile ↗</button><button class="trade-side-btn danger" data-report-user="${state.activePeer}">⚑ Report trader</button>`; bindDynamic(panel); return;}
    const st=messageStatus(trade), own=trade.user_id===state.session?.user.id;
    const offerLabel=own?'YOU OFFER':'THEY OFFER', wantLabel=own?'YOU WANT':'THEY WANT';
    const offerItems=tradeItems(trade,'offer'),wantItems=tradeItems(trade,'want'); panel.innerHTML=`<div class="trade-side-head"><strong>Trade details</strong><span class="conversation-status ${st.key}">${st.label}</span></div><div class="trade-side-id">#${esc(String(trade.id).slice(0,10))}</div><div class="trade-side-section"><label>${offerLabel} · ${offerItems.length}</label>${tradeSpriteTiles(offerItems,'OFFER')}</div><div class="trade-swap-arrow">⇅</div><div class="trade-side-section"><label>${wantLabel} · ${wantItems.length}</label>${tradeSpriteTiles(wantItems,'WANT')}</div><div class="trade-description"><label>DESCRIPTION</label><p>${esc(trade.note||'No description provided.')}</p></div><div class="trade-side-actions"><button class="trade-side-btn" data-profile="${state.activePeer}">View trader profile ↗</button><button class="trade-side-btn" data-jump-trade="${trade.id}">View full trade ↗</button>${own&&trade.status==='open'?`<button class="trade-side-btn complete" data-complete-trade="${trade.id}">✓ Mark completed</button>`:''}${trade.status==='open'&&own?`<button class="trade-side-btn" data-close-trade="${trade.id}">Cancel trade</button>`:''}<button class="trade-side-btn danger" data-report-user="${state.activePeer}" data-report-trade="${trade.id}">⚑ Report trader</button></div>`;
    bindDynamic(panel);
    panel.querySelector('[data-jump-trade]')?.addEventListener('click',()=>{$('#messageDialog').close();location.hash='trades';});
    panel.querySelector('[data-complete-trade]')?.addEventListener('click',async()=>{const ok=await confirmAction({title:'Mark trade completed?',message:'Only confirm after the in-game swap is finished.',confirmText:'Mark completed'});if(!ok)return;const {error}=await sb.from('trades').update({status:'closed'}).eq('id',trade.id);if(error)return toast(error.message,true);toast('Trade completed ✓');await refreshAll();renderMessages();});
  }
  async function markRead(){
    if(!state.activePeer||!state.session)return;
    let q=sb.from('messages').update({read_at:new Date().toISOString()}).eq('recipient_id',state.session.user.id).eq('sender_id',state.activePeer).is('read_at',null);
    q=state.activeTradeId?q.eq('trade_id',state.activeTradeId):q.is('trade_id',null);
    await q; await loadMessages(); updateUnread();
  }
  function updateUnread(){ const uid=state.session?.user.id,accepted=new Set(state.tradeRequests.filter(r=>['accepted','completed'].includes(r.status)).map(r=>r.trade_id)); const n=uid?state.messages.filter(m=>m.recipient_id===uid&&!m.read_at&&m.trade_id&&accepted.has(m.trade_id)).length:0; $('#unreadBadge').textContent=n; $('#unreadBadge').classList.toggle('hidden',!n); }
  async function startMessage(peer, tradeId=null){ if(!requireAuth())return; state.activePeer=peer; state.activeTradeId=tradeId||null; await loadMessages(); renderMessages(); $('#messageDialog').dataset.tradeId=tradeId||''; $('#messageDialog').showModal(); }

  function subscribeRealtime(){ if(!sb)return; sb.channel('spriteswap-live').on('postgres_changes',{event:'*',schema:'public',table:'trades'},()=>refreshAll()).on('postgres_changes',{event:'*',schema:'public',table:'trade_requests'},()=>refreshAll()).on('postgres_changes',{event:'*',schema:'public',table:'sprite_inventory'},()=>refreshAll()).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async payload=>{ const uid=state.session?.user.id; if(uid&&(payload.new.sender_id===uid||payload.new.recipient_id===uid)){await loadMessages(); updateAuthUI();}}).subscribe(); }

  async function openAdmin(){ if(!state.me?.is_admin)return; $('#adminDialog').showModal(); await renderAdmin(); }
  async function renderAdmin(){ let html=''; if(state.adminTab==='reports'){ const {data}=await sb.from('reports').select('*, reporter:reporter_id(username), reported:reported_user_id(username), trade:trade_id(offer,want)').order('created_at',{ascending:false}).limit(100); html=(data||[]).map(r=>`<div class="admin-row"><div><b>${esc(r.reason)}</b> <span class="tier">${esc(r.status)}</span><div class="muted">Reporter @${esc(r.reporter?.username||'?')} · Target @${esc(r.reported?.username||'?')}</div><div>${esc(r.details||'No details')}</div></div><div class="admin-actions">${['reviewed','dismissed','actioned'].map(s=>`<button class="btn btn-secondary btn-small" data-report-status="${r.id}:${s}">${s}</button>`).join('')}</div></div>`).join('')||'<div class="empty">No reports.</div>'; }
    if(state.adminTab==='trades'){ const {data}=await sb.from('trades').select('*, profiles:user_id(username)').order('created_at',{ascending:false}).limit(100); html=(data||[]).map(t=>{const os=tradeItems(t,'offer'),ws=tradeItems(t,'want');return `<div class="admin-row"><div><b>@${esc(t.profiles?.username||'?')}</b> — ${os.length} offered → ${ws.length} wanted <span class="tier">${esc(t.status)}</span><div class="muted">${esc(os.join(', '))} ↔ ${esc(ws.join(', '))}</div></div><div class="admin-actions"><button class="btn btn-danger btn-small" data-remove-trade="${t.id}">Remove</button></div></div>`}).join(''); }
    if(state.adminTab==='users'){ const {data}=await sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(100); html=(data||[]).map(p=>`<div class="admin-row"><div><b>@${esc(p.username)}</b> ${p.is_admin?'<span class="tier">ADMIN</span>':''} ${p.is_banned?'<span class="danger-text">BANNED</span>':''}<div class="muted">★ ${Number(p.rating_avg||0).toFixed(1)} · joined ${fmt(p.created_at)}</div></div><div class="admin-actions"><button class="btn btn-secondary btn-small" data-ban-user="${p.id}:${!p.is_banned}">${p.is_banned?'Unban':'Ban'}</button></div></div>`).join(''); }
    $('#adminContent').innerHTML=html; bindAdminActions(); }

  function bindAdminActions(){
    $$('[data-report-status]').forEach(b=>b.onclick=async()=>{const [id,status]=b.dataset.reportStatus.split(':'); await sb.from('reports').update({status}).eq('id',id); renderAdmin();});
    $$('[data-remove-trade]').forEach(b=>b.onclick=async()=>{await sb.from('trades').update({status:'removed'}).eq('id',b.dataset.removeTrade); await renderAdmin(); await refreshAll();});
    $$('[data-ban-user]').forEach(b=>b.onclick=async()=>{const [id,v]=b.dataset.banUser.split(':'); await sb.from('profiles').update({is_banned:v==='true'}).eq('id',id); renderAdmin();});
  }

  function bindDynamic(root=document){
    root.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>openProfile(b.dataset.profile));
    root.querySelectorAll('[data-message]').forEach(b=>b.onclick=()=>startMessage(b.dataset.message,b.dataset.trade));
    root.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{if(requireAuth())openProfile(b.dataset.rate,true,b.dataset.trade)});
    root.querySelectorAll('[data-report-user]').forEach(b=>b.onclick=()=>openReport(b.dataset.reportUser,b.dataset.reportTrade));
    root.querySelectorAll('[data-close-trade]').forEach(b=>b.onclick=async()=>{const ok=await confirmAction({title:'Close this listing?',message:'It will disappear from the live trade board.',confirmText:'Close listing',danger:true});if(!ok)return;await sb.from('trades').update({status:'closed'}).eq('id',b.dataset.closeTrade);await refreshAll();});
    root.querySelectorAll('.star-btn').forEach(b=>b.onclick=()=>{ const n=+b.dataset.stars; root.querySelector('input[name="stars"]').value=n; root.querySelectorAll('.star-btn').forEach(x=>x.classList.toggle('active',+x.dataset.stars<=n)); });
    const rf=root.querySelector('#ratingForm'); if(rf) rf.onsubmit=submitRating;
  }

  function openReport(uid,tradeId=''){ if(!requireAuth())return; const f=$('#reportForm'); f.reported_user_id.value=uid||''; f.trade_id.value=tradeId||''; $('#reportDialog').showModal(); }
  async function submitRating(e){ e.preventDefault(); if(!requireAuth())return; const f=new FormData(e.target); const payload={rater_id:state.session.user.id,rated_id:f.get('rated_id'),trade_id:f.get('trade_id')||null,stars:+f.get('stars'),comment:f.get('comment')}; const {error}=await sb.from('ratings').upsert(payload,{onConflict:'rater_id,rated_id'}); if(error)return toast(error.message,true); toast('Rating saved'); $('#profileDialog').close(); await refreshAll(); }

  function bindUI(){
    $$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
    $('#spriteSearch').oninput=renderSprites; $('#seasonFilter').onchange=renderSprites; $('#rarityFilter').onchange=renderSprites; $('#variantFilter').onchange=renderSprites; $('#spriteSort').onchange=renderSprites;
    if($('#headerSearch')){
      $('#headerSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#spriteSearch').value=e.currentTarget.value;renderSprites();location.hash='sprites';setTimeout(()=>$('#spriteSearch')?.focus(),80);}});
      document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){e.preventDefault();$('#headerSearch').focus();}});
    }
    $$('.jump-chip').forEach(chip=>chip.addEventListener('click',()=>{const map={base:'Base',gold:'Gold',cheat:'Cheat Master',galaxy:'Galaxy'},key=[...chip.classList].find(c=>map[c]);if(key&&$('#variantFilter')){$('#variantFilter').value=map[key];renderSprites();}}));
    $('#spriteGrid').onclick=e=>{const o=e.target.closest('[data-own-sprite]');if(o)return toggleSprite(o.dataset.ownSprite,'owned',o);const m=e.target.closest('[data-master-sprite]');if(m)return toggleSprite(m.dataset.masterSprite,'mastered',m);};
    $('#spriteNames').innerHTML=sprites.map(s=>`<option value="${esc(s.name)}"></option>`).join('');
    renderSprites();
    const initialQ=new URLSearchParams(location.search).get('q')||''; if(initialQ){$('#spriteSearch').value=initialQ;$('#tradeSearch').value=initialQ;renderSprites();}
    $('#tradeSearch').oninput=renderTrades; $('#tierFilter').onchange=renderTrades; $('#tradeMatchFilter')?.addEventListener('change',renderTrades); $('#tradeSort')?.addEventListener('change',renderTrades); $('#memberSearch').oninput=renderMembers;
    $('#postTradeBtn').onclick=()=>requireAuth()&&$('#tradeDialog').showModal();
    $('#heroJoinBtn').onclick=()=>$('#authDialog').showModal();
    $('#authBtn').onclick=()=>{ if(state.session){$('#accountMenu').classList.toggle('hidden');$('#notificationsPanel')?.classList.add('hidden');} else $('#authDialog').showModal(); };
    $('#messagesBtn').onclick=()=>{if(requireAuth()){renderMessages();$('#messageDialog').showModal();}};
    $('#notificationsBtn')?.addEventListener('click',()=>{if(!requireAuth())return;renderHeaderPanels();$('#notificationsPanel').classList.toggle('hidden');$('#accountMenu')?.classList.add('hidden');});
    $('#myProfileBtn')?.addEventListener('click',()=>{if(state.session){$('#accountMenu').classList.add('hidden');openProfile(state.session.user.id);}});
    $('#myCollectionBtn')?.addEventListener('click',()=>{if(state.session){$('#accountMenu').classList.add('hidden');openProfile(state.session.user.id);}});
    $('#myMessagesBtn')?.addEventListener('click',()=>{if(state.session){$('#accountMenu').classList.add('hidden');renderMessages();$('#messageDialog').showModal();}});
    $('#logoutBtn')?.addEventListener('click',async()=>{await sb?.auth.signOut();$('#accountMenu').classList.add('hidden');});
    $('#adminBtn').onclick=openAdmin;
    $('#authForm').onsubmit=async e=>{e.preventDefault(); location.href='/api/discord-login';};
    $('#tradeForm').onsubmit=async e=>{e.preventDefault(); if(!requireAuth())return; const f=new FormData(e.target); const {error}=await sb.from('trades').insert({user_id:state.session.user.id,offer:f.get('offer'),want:f.get('want'),tier:f.get('tier'),note:f.get('note')}); $('#tradeNote').textContent=error?error.message:'Published!'; if(!error){e.target.reset();setTimeout(()=>$('#tradeDialog').close(),400);await refreshAll();}};
    $('#messageForm').onsubmit=async e=>{e.preventDefault(); if(!state.activePeer)return; const body=$('#messageInput').value.trim(); if(!body)return; const {error}=await sb.from('messages').insert({sender_id:state.session.user.id,recipient_id:state.activePeer,trade_id:state.activeTradeId||null,body}); if(error)return toast(error.message,true); $('#messageInput').value=''; await loadMessages(); renderMessages();};
    $('#conversationList').onclick=e=>{const b=e.target.closest('[data-peer]');if(b){state.activePeer=b.dataset.peer;state.activeTradeId=b.dataset.conversationTrade||null;renderMessages();}};
    $('#conversationSearch').oninput=e=>{state.messageSearch=e.target.value;renderMessages();};
    $$('[data-message-filter]').forEach(b=>b.onclick=()=>{$$('[data-message-filter]').forEach(x=>x.classList.toggle('active',x===b));state.messageFilter=b.dataset.messageFilter;renderMessages();});
    $('#reportForm').onsubmit=async e=>{e.preventDefault(); const f=new FormData(e.target); const {error}=await sb.from('reports').insert({reporter_id:state.session.user.id,reported_user_id:f.get('reported_user_id')||null,trade_id:f.get('trade_id')||null,reason:f.get('reason'),details:f.get('details')}); if(error)return toast(error.message,true); toast('Report sent to moderators'); e.target.reset(); $('#reportDialog').close();};
    $$('.admin-tabs button').forEach(b=>b.onclick=()=>{$$('.admin-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.adminTab=b.dataset.adminTab;renderAdmin();});
    document.addEventListener('click',e=>{const el=e.target.closest('[data-profile],[data-message],[data-rate],[data-report-user],[data-close-trade]');if(el&&!el.closest('#profileDialog'))bindDynamic(document);},{once:true});
    document.addEventListener('click',e=>{ const p=e.target.closest('[data-profile]'); if(p)openProfile(p.dataset.profile); const m=e.target.closest('[data-message]'); if(m)startMessage(m.dataset.message,m.dataset.trade); const r=e.target.closest('[data-rate]'); if(r&&requireAuth())openProfile(r.dataset.rate,true,r.dataset.trade); const rp=e.target.closest('[data-report-user]'); if(rp)openReport(rp.dataset.reportUser,rp.dataset.reportTrade); const ct=e.target.closest('[data-close-trade]'); if(ct){confirmAction({title:'Close this listing?',message:'It will disappear from the live trade board.',confirmText:'Close listing',danger:true}).then(ok=>{if(ok)sb.from('trades').update({status:'closed'}).eq('id',ct.dataset.closeTrade).then(refreshAll);});} });
  }

  boot();
})();
