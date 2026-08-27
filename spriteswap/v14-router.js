(() => {
  const go=u=>location.href=u;
  document.addEventListener('click',e=>{
    const t=e.target.closest('button,a'); if(!t)return;
    if(t.id==='messagesBtn'||t.id==='myMessagesBtn'){e.preventDefault();e.stopImmediatePropagation();return go('/messages.html')}
    if(t.id==='notificationsBtn'){e.preventDefault();e.stopImmediatePropagation();return go('/notifications.html')}
    if(t.id==='adminBtn'){e.preventDefault();e.stopImmediatePropagation();return go('/admin.html')}
    if(t.id==='postTradeBtn'){e.preventDefault();e.stopImmediatePropagation();return go('/new-trade.html')}
    if(t.id==='myProfileBtn'){e.preventDefault();e.stopImmediatePropagation();return go('/profile.html')}
    if(t.id==='myCollectionBtn'){e.preventDefault();e.stopImmediatePropagation();return go('/collection.html')}
    if(t.id==='heroJoinBtn'){e.preventDefault();e.stopImmediatePropagation();return go('/api/discord-login')}
    if(t.id==='authBtn'&&!t.querySelector('img')){e.preventDefault();e.stopImmediatePropagation();return go('/api/discord-login')}
    const p=t.closest('[data-profile]');if(p){e.preventDefault();e.stopImmediatePropagation();return go(`/profile.html?id=${encodeURIComponent(p.dataset.profile)}`)}
    const m=t.closest('[data-message]');if(m){e.preventDefault();e.stopImmediatePropagation();const trade=m.dataset.trade||'';return go(trade?`/messages.html?peer=${encodeURIComponent(m.dataset.message)}&trade=${encodeURIComponent(trade)}`:'/messages.html')}
    const rp=t.closest('[data-report-user]');if(rp){e.preventDefault();e.stopImmediatePropagation();return go(`/report.html?user=${encodeURIComponent(rp.dataset.reportUser||'')}&trade=${encodeURIComponent(rp.dataset.reportTrade||'')}`)}
    const r=t.closest('[data-rate]');if(r){e.preventDefault();e.stopImmediatePropagation();return go(`/profile.html?id=${encodeURIComponent(r.dataset.rate)}&rate=1&trade=${encodeURIComponent(r.dataset.trade||'')}`)}
  },true);
})();
