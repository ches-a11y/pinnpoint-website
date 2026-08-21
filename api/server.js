/**
 * Pinnpoint × nShift — partner pipeline feed
 *
 * Serves GET /partner-data.json in exactly the shape partner-dashboard.html
 * expects. Reads live pipeline data from Pipedrive (the system of record for
 * every website enquiry, sample request and order).
 *
 * Zero dependencies. Node 20+.
 *
 * Environment:
 *   PIPEDRIVE_API_TOKEN   required for live data; without it the feed returns
 *                         the preview payload so the dashboard still renders
 *   PIPEDRIVE_DOMAIN      e.g. "pinnpt" for pinnpt.pipedrive.com (default: api)
 *   COMMISSION_START      ISO date commission begins (default 2026-09-01)
 *   COMMISSION_PER_BOX    EUR per box of 1,000 sheets (default 10)
 *   ALLOWED_ORIGINS       comma-separated (default pinnpt.com + www)
 *   CACHE_TTL_SECONDS     default 600
 *   PORT                  provided by Railway
 */

'use strict';

const http = require('node:http');

const TOKEN = process.env.PIPEDRIVE_API_TOKEN || '';
const PD_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'api';
const COMMISSION_START = process.env.COMMISSION_START || '2026-09-01';
const PER_BOX = Number(process.env.COMMISSION_PER_BOX || 10);
const CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS || 600) * 1000;
const PORT = Number(process.env.PORT || 3000);

const ALLOWED = (process.env.ALLOWED_ORIGINS ||
  'https://pinnpt.com,https://www.pinnpt.com,https://ches-a11y.github.io')
  .split(',').map(s => s.trim()).filter(Boolean);

const COMMISSION_NOTE =
  'Commission is €10 per box (1,000 sheets), or the GBP equivalent for UK orders, ' +
  'on every new customer order from 1 September 2026 per the Pinnpoint–nShift partner agreement.';

/* ---------------------------------------------------------------- regions */

const REGIONS = [
  { key: 'Benelux',      c: '--benelux' },
  { key: 'Germany',      c: '--germany' },
  { key: 'UK & Ireland', c: '--uki'     }
];

const TLD_REGION = {
  nl: 0, be: 0, lu: 0,
  de: 1, at: 1, ch: 1,
  uk: 2, ie: 2
};

const COUNTRY_REGION = [
  [/\b(netherlands|nederland|holland|belgium|belgi[eë]|luxembourg|luxemburg)\b/i, 0],
  [/\b(germany|deutschland|austria|[oö]sterreich|switzerland|schweiz)\b/i, 1],
  [/\b(united kingdom|great britain|england|scotland|wales|ireland|eire)\b/i, 2]
];

/** Best-effort market for a record. Email country TLD first, then free text. */
function regionOf(email, text) {
  if (email) {
    const tld = String(email).trim().toLowerCase().split('.').pop();
    if (tld in TLD_REGION) return TLD_REGION[tld];
  }
  if (text) {
    for (const [re, idx] of COUNTRY_REGION) if (re.test(text)) return idx;
  }
  return null; // unknown — counted in totals, not attributed to a market
}

/* ------------------------------------------------------------- pipedrive */

function pdUrl(path, params = {}) {
  const u = new URL(`https://${PD_DOMAIN}.pipedrive.com/api/v1${path}`);
  u.searchParams.set('api_token', TOKEN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u;
}

async function pdGetAll(path, params = {}) {
  const out = [];
  let start = 0;
  for (let page = 0; page < 20; page++) {
    const res = await fetch(pdUrl(path, { ...params, start, limit: 500 }), {
      headers: { accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`Pipedrive ${path} → HTTP ${res.status}`);
    const body = await res.json();
    if (body.success === false) throw new Error(`Pipedrive ${path} → ${body.error}`);
    if (Array.isArray(body.data)) out.push(...body.data);
    const more = body.additional_data?.pagination;
    if (!more?.more_items_in_collection) break;
    start = more.next_start;
  }
  return out;
}

/* --------------------------------------------------------------- helpers */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseTime(s) {
  // Pipedrive returns "2026-08-19 14:03:22" (UTC)
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Deals are titled "Order - {company} - {N} cases" by the Make scenario. */
function boxesFromTitle(title) {
  const m = /(\d[\d\s.,]*)\s*(cases?|boxes?)\b/i.exec(String(title || ''));
  if (!m) return 0;
  const n = parseInt(m[1].replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function companyFromTitle(title) {
  const m = /^Order\s*-\s*(.+?)\s*-\s*\d/.exec(String(title || ''));
  return m ? m[1] : String(title || '').trim();
}

function primaryEmail(person) {
  const e = person?.email;
  if (Array.isArray(e)) return e.find(x => x?.primary)?.value || e[0]?.value || '';
  return typeof e === 'string' ? e : '';
}

function eur(n) {
  if (n >= 1000) return '€' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '€' + Math.round(n).toLocaleString('en-GB');
}

function monthKey(d) { return d.getUTCFullYear() * 12 + d.getUTCMonth(); }

function niceDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function pct(part, whole) { return whole ? Math.round((part / whole) * 100) : 0; }

function delta(now, prev) {
  if (!prev) return now ? 'new this month' : '—';
  const p = Math.round(((now - prev) / prev) * 100);
  if (p === 0) return 'level vs prev month';
  return (p > 0 ? '▲ ' : '▼ ') + Math.abs(p) + '% vs prev month';
}

/* ------------------------------------------------------------------ build */

function buildPayload(deals, persons) {
  const now = new Date();
  const thisMonth = monthKey(now);
  const startMs = new Date(COMMISSION_START + 'T00:00:00Z').getTime();

  const orders = [];
  for (const d of deals) {
    const t = parseTime(d.add_time);
    if (!t) continue;
    const email = primaryEmail(d.person_id) || d.person_id?.email?.[0]?.value || '';
    const org = d.org_id?.name || '';
    orders.push({
      company: companyFromTitle(d.title) || org || 'Customer',
      value: Number(d.value || 0),
      currency: d.currency || 'EUR',
      boxes: boxesFromTitle(d.title),
      status: d.status === 'won' ? 'Won' : d.status === 'lost' ? 'Lost' : 'Invoiced',
      won: d.status === 'won',
      time: t,
      region: regionOf(email, org + ' ' + (d.title || ''))
    });
  }

  const leads = [];
  for (const p of persons) {
    const t = parseTime(p.add_time);
    if (!t) continue;
    const email = primaryEmail(p);
    // Make writes "{contact name} — {company}"
    const company = String(p.name || '').split(/\s+—\s+/)[1] || String(p.name || '');
    leads.push({ company, email, time: t, region: regionOf(email, company) });
  }

  // ---- headline numbers -------------------------------------------------
  const inMonth = (arr, k) => arr.filter(x => monthKey(x.time) === k);
  const leadsMTD = inMonth(leads, thisMonth);
  const leadsPrev = inMonth(leads, thisMonth - 1);
  const ordersMTD = inMonth(orders, thisMonth);
  const ordersPrev = inMonth(orders, thisMonth - 1);

  const revenueMTD = ordersMTD.reduce((s, o) => s + o.value, 0);
  const revenuePrev = ordersPrev.reduce((s, o) => s + o.value, 0);

  const boxesAll = orders.reduce((s, o) => s + o.boxes, 0);
  const commissionable = orders.filter(o => o.time.getTime() >= startMs);
  const boxes = commissionable.reduce((s, o) => s + o.boxes, 0);
  const commission = boxes * PER_BOX;
  const started = Date.now() >= startMs;
  const startLabel = niceDate(COMMISSION_START);

  const kpis = [
    { lab: 'Leads (MTD)',       val: String(leadsMTD.length),  dl: delta(leadsMTD.length, leadsPrev.length) },
    { lab: 'Orders (MTD)',      val: String(ordersMTD.length), dl: delta(ordersMTD.length, ordersPrev.length) },
    { lab: 'Revenue (MTD)',     val: eur(revenueMTD),          dl: delta(revenueMTD, revenuePrev) },
    { lab: 'Boxes ordered',     val: boxesAll.toLocaleString('en-GB'),
      dl: started ? `${boxes.toLocaleString('en-GB')} commissionable` : 'total to date' },
    { lab: 'nShift commission', val: eur(commission),
      dl: started ? `€${PER_BOX} / box · ${boxes.toLocaleString('en-GB')} boxes`
                  : `accrues from ${startLabel}` }
  ];

  // ---- activity by region ----------------------------------------------
  const zero = () => [0, 0, 0];
  const act = { Leads: zero(), Orders: zero() };
  for (const l of leads) if (l.region !== null) act.Leads[l.region]++;
  for (const o of orders) if (o.region !== null) act.Orders[o.region]++;
  const actMax = Math.max(5, ...act.Leads, ...act.Orders);

  // ---- six-month revenue trend -----------------------------------------
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: monthKey(d), label: MONTHS[d.getUTCMonth()] });
  }
  const series = REGIONS.map((_, ri) =>
    months.map(m => {
      const v = orders
        .filter(o => o.region === ri && monthKey(o.time) === m.key)
        .reduce((s, o) => s + o.value, 0);
      return Math.round((v / 1000) * 10) / 10;
    })
  );
  const trendMax = Math.max(5, ...series.flat().map(v => Math.ceil(v / 5) * 5));

  // ---- conversion -------------------------------------------------------
  const totalLeads = leads.length;
  const totalOrders = orders.length;
  const funnel = [
    { label: 'Leads',  n: totalLeads,  pct: 100, meta: '' },
    { label: 'Orders', n: totalOrders, pct: Math.max(6, pct(totalOrders, totalLeads)),
      meta: totalLeads ? `<b>${pct(totalOrders, totalLeads)}%</b> of leads convert to an order` : '' }
  ];

  // ---- recent activity --------------------------------------------------
  const recent = [
    ...orders.map(o => ({
      company: o.company, region: o.region, type: 'Order', time: o.time,
      value: (o.currency === 'GBP' ? '£' : '€') + Math.round(o.value).toLocaleString('en-GB'),
      status: o.status, good: o.won
    })),
    ...leads.map(l => ({
      company: l.company, region: l.region, type: 'Lead', time: l.time,
      value: '—', status: 'In pipeline'
    }))
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 8)
    .map(({ time, ...r }) => r); // region stays null when the market is unknown

  return {
    updated: 'Live · updated ' + now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    live: true,
    commissionNote: COMMISSION_NOTE,
    kpis,
    regions: REGIONS,
    activity: { labels: ['Leads', 'Orders'], values: act, max: actMax },
    trend: { months: months.map(m => m.label), series, max: trendMax },
    funnel,
    recent
  };
}

/* ---------------------------------------------------------------- preview */

function previewPayload(reason) {
  return {
    updated: reason,
    live: false,
    commissionNote: COMMISSION_NOTE,
    kpis: [
      { lab: 'Leads (MTD)', val: '—', dl: '' },
      { lab: 'Orders (MTD)', val: '—', dl: '' },
      { lab: 'Revenue (MTD)', val: '—', dl: '' },
      { lab: 'Boxes ordered', val: '—', dl: '' },
      { lab: 'nShift commission', val: '—', dl: `€${PER_BOX} / box from ${niceDate(COMMISSION_START)}` }
    ],
    regions: REGIONS,
    activity: { labels: ['Leads', 'Orders'], values: { Leads: [0, 0, 0], Orders: [0, 0, 0] }, max: 5 },
    trend: { months: MONTHS.slice(2, 8), series: [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]], max: 5 },
    funnel: [{ label: 'Leads', n: 0, pct: 100, meta: '' }, { label: 'Orders', n: 0, pct: 6, meta: '' }],
    recent: []
  };
}

/* ------------------------------------------------------------------ cache */

let cache = { at: 0, body: null };

async function getPayload() {
  if (cache.body && Date.now() - cache.at < CACHE_TTL) return cache.body;
  let payload;
  if (!TOKEN) {
    payload = previewPayload('Waiting for the Pipedrive connection — no figures shown until the feed is live.');
  } else {
    try {
      const [deals, persons] = await Promise.all([
        pdGetAll('/deals', { status: 'all_not_deleted' }),
        pdGetAll('/persons')
      ]);
      payload = buildPayload(deals, persons);
    } catch (err) {
      console.error('[feed] pipedrive error:', err.message);
      if (cache.body) return cache.body; // serve last good data rather than blanking
      payload = previewPayload('Feed temporarily unavailable — retrying.');
    }
  }
  cache = { at: Date.now(), body: payload };
  return payload;
}

/* ----------------------------------------------------------------- server */

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) res.setHeader('access-control-allow-origin', origin);
  else res.setHeader('access-control-allow-origin', ALLOWED[0]);
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'GET,OPTIONS');
  res.setHeader('access-control-max-age', '86400');
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  const path = new URL(req.url, 'http://x').pathname;

  if (path === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, configured: Boolean(TOKEN) }));
    return;
  }

  if (path === '/partner-data.json' || path === '/') {
    try {
      const body = JSON.stringify(await getPayload());
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300'
      });
      res.end(body);
    } catch (err) {
      console.error('[feed] fatal:', err);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'feed unavailable' }));
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => console.log(`[feed] listening on ${PORT}, live=${Boolean(TOKEN)}`));
