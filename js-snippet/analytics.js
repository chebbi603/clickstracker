(function(){
  const API_URL = 'http://localhost:4000/events';
  const BATCH_SIZE = 10;
  const FLUSH_INTERVAL = 3000; // ms
  const SCROLL_THROTTLE = 1000; // ms

  function uuid(){
    try{ return crypto.randomUUID(); } catch(e){ return 'xxxxxx'.replace(/x/g,()=>((Math.random()*36)|0).toString(36)); }
  }

  function getSessionId(){
    try{
      const key = 'ux_analytics_sid';
      let sid = localStorage.getItem(key);
      if(!sid){ sid = uuid(); localStorage.setItem(key, sid); }
      return sid;
    }catch(e){ return uuid(); }
  }

  function selectorFor(el){
    if(!el || !el.nodeType) return null;
    if(el.id) return '#' + el.id;
    let sel = el.tagName ? el.tagName.toLowerCase() : '';
    if(el.classList && el.classList.length){ sel += '.' + Array.from(el.classList).slice(0,3).join('.'); }
    return sel || null;
  }

  const queue = [];
  let lastScrollEventTs = 0;

  function enqueue(evt){
    queue.push(evt);
    if(queue.length >= BATCH_SIZE){ flush(); }
  }

  function flush(){
    if(queue.length === 0) return;
    const payload = { events: queue.splice(0, queue.length) };
    navigator.sendBeacon ?
      navigator.sendBeacon(API_URL, new Blob([JSON.stringify(payload)], { type: 'application/json' })) :
      fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true}).catch(()=>{});
  }

  // Click capture
  document.addEventListener('click', function(e){
    const t = e.target;
    const rect = t && t.getBoundingClientRect ? t.getBoundingClientRect() : {left:0,top:0};
    enqueue({
      sessionId: getSessionId(),
      pageUrl: location.href,
      eventType: 'click',
      elementSelector: selectorFor(t),
      clickX: Math.round(e.clientX - rect.left),
      clickY: Math.round(e.clientY - rect.top),
      scrollDepth: null,
      timestamp: Date.now()
    });
  }, { passive: true });

  // Scroll capture (throttled)
  window.addEventListener('scroll', function(){
    const now = Date.now();
    if(now - lastScrollEventTs < SCROLL_THROTTLE) return;
    lastScrollEventTs = now;
    const doc = document.documentElement;
    const scrollTop = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0);
    const height = doc.scrollHeight - doc.clientHeight;
    const depth = height > 0 ? Math.round((scrollTop / height) * 100) : 0;
    enqueue({
      sessionId: getSessionId(),
      pageUrl: location.href,
      eventType: 'scroll',
      elementSelector: null,
      clickX: null,
      clickY: null,
      scrollDepth: depth,
      timestamp: now
    });
  }, { passive: true });

  // Periodic flush
  setInterval(flush, FLUSH_INTERVAL);
  window.addEventListener('beforeunload', flush);
})();