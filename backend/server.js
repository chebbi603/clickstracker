const express = require('express');
const cors = require('cors');
const { validateBatch } = require('./schema');
const Database = require('./database');
const RulesEngine = require('./rules-engine');

const app = express();
const db = new Database();
const rules = new RulesEngine(db);
const PORT = process.env.PORT || 4000;

// CORS configuration to support credentials (sendBeacon uses credentials: 'include')
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'null' // when opening files from disk, Origin is 'null'
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser tools
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '200kb' }));

// SSE Clients
const sseClients = new Set();

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/snippet.js', (req, res) => {
  // Serve the collector snippet for easy copy/paste
  const apiBase = process.env.PUBLIC_API_URL || ('http://localhost:' + PORT);
  res.type('application/javascript').send(`
(function(){
  const API_URL = 'REPLACE_API_BASE/events';
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
  `.replace('REPLACE_API_BASE', apiBase));
});

app.post('/events', async (req, res) => {
  const body = req.body;
  console.log('[DEBUG] Received events batch:', JSON.stringify(body, null, 2));
  
  if (!validateBatch(body)) {
    console.log('[DEBUG] Validation failed:', validateBatch.errors);
    return res.status(400).json({ error: 'Invalid payload', details: validateBatch.errors });
  }
  try {
    await db.insertEvents(body.events);
    console.log('[DEBUG] Successfully inserted', body.events.length, 'events');
    broadcastSSE({ type: 'metrics_update' });
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('Insert error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// SSE endpoint for live updates
app.get('/metrics/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

app.get('/metrics', async (req, res) => {
  try {
    const metrics = await db.getAggregatedMetrics();
    res.json(metrics);
  } catch (e) {
    console.error('Metrics error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Rules Engine endpoints
app.get('/rules/config', (req, res) => {
  res.json({ rules: rules.getRuleConfiguration() });
});

app.get('/rules/issues', async (req, res) => {
  try {
    const issues = await rules.analyzeAllRules();
    res.json({ issues });
  } catch (e) {
    console.error('Rules issues error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept/Reject feedback for suggestions
// In this MVP we just log feedback; in a real app we'd persist it
app.post('/rules/feedback', express.json(), (req, res) => {
  const { issueId, suggestionId, action } = req.body || {};
  if (!issueId || !suggestionId || !['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid feedback payload' });
  }
  console.log('[RULES FEEDBACK]', { issueId, suggestionId, action, ts: Date.now() });
  res.json({ status: 'ok' });
});
(async () => {
  await db.init();
  app.listen(PORT, () => {
    console.log(`Backend API listening on http://localhost:${PORT}`);
  });
})();