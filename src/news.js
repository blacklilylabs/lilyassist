// Pobiera newsy z IT i cyberbezpieczeństwa (RSS/Atom + Hacker News)
// i rozpoznaje ważne wpisy: nowe luki, aktywnie wykorzystywane błędy, ataki.
const { net } = require('electron');

// Wbudowane kanały. `alert: true` = każdy wpis z tego kanału jest ważny.
const BUILTIN_FEEDS = [
  { id: 'sekurak', name: 'Sekurak', url: 'https://sekurak.pl/feed/' },
  { id: 'niebezpiecznik', name: 'Niebezpiecznik', url: 'https://niebezpiecznik.pl/feed/' },
  { id: 'hackernews-yc', name: 'Hacker News', type: 'hn' },
  { id: 'thehackernews', name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { id: 'krebs', name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { id: 'darkreading', name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
  { id: 'therecord', name: 'The Record', url: 'https://therecord.media/feed' },
  { id: 'helpnetsecurity', name: 'Help Net Security', url: 'https://www.helpnetsecurity.com/feed/' },
  { id: 'cisa', name: 'CISA Alerts', url: 'https://www.cisa.gov/cybersecurity-advisories/alerts.xml', alert: true },
];

// Słowa, po których poznajemy ważny wpis (po polsku i po angielsku).
const IMPORTANT = new RegExp(
  [
    'CVE-\\d{4}-\\d+', 'zero[- ]?day', '0[- ]?day', 'actively exploited', 'exploited in the wild',
    'known exploited', 'critical', 'krytyczn', 'emergency', 'patch now', 'urgent', 'pilne', 'pilnie',
    'ransomware', 'remote code execution', '\\bRCE\\b', 'backdoor', 'supply[- ]chain attack',
    'wyciek', 'data breach', 'zhakowan', 'zhackowan', '\\bluk[aię]\\b', 'vulnerabilit', 'ostrzega',
  ].join('|'),
  'i'
);

const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

let items = [];
const shown = new Set();

async function get(url, as = 'text') {
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const tag = (block, name) => (block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)) || [])[1] || '';

// Rozumie oba formaty: RSS (<item>) i Atom (<entry>).
function parseFeed(xml, feed) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) || [];
  return blocks.slice(0, 15).map((b) => {
    const title = decode(tag(b, 'title'));
    const link = decode(
      (b.match(/<link>([\s\S]*?)<\/link>/) ||
        b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) ||
        b.match(/<link[^>]*href="([^"]+)"/) ||
        [])[1] || ''
    );
    const when = Date.parse(decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')));
    return makeItem(feed, title, link, when);
  });
}

function makeItem(feed, title, link, date) {
  return {
    source: feed.name,
    title,
    link,
    date: Number.isFinite(date) ? date : null,
    important: Boolean(feed.alert) || IMPORTANT.test(title),
  };
}

async function fetchHackerNews(feed) {
  const ids = (await get(HN_TOP, 'json')).slice(0, 8);
  const stories = await Promise.all(ids.map((id) => get(HN_ITEM(id), 'json').catch(() => null)));
  return stories
    .filter((s) => s && s.title)
    .map((s) => makeItem(feed, s.title, s.url || `https://news.ycombinator.com/item?id=${s.id}`, s.time * 1000));
}

async function fetchFeed(feed) {
  const list = feed.type === 'hn' ? await fetchHackerNews(feed) : parseFeed(await get(feed.url), feed);
  return list.filter((n) => n.title && /^https?:\/\//.test(n.link));
}

// Pobiera wszystkie podane kanały naraz; błąd jednego nie psuje reszty.
async function refresh(feeds) {
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const fresh = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`Nie udało się pobrać „${feeds[i].name}”:`, r.reason.message);
  });
  if (fresh.length || !feeds.length) items = fresh;
}

// Sprawdza kanał przed dodaniem (w ustawieniach).
async function test(url) {
  const list = await fetchFeed({ name: 'test', url });
  if (!list.length) throw Object.assign(new Error('no items'), { code: 'NO_ITEMS' });
  return { count: list.length, first: list[0].title };
}

// Losowy news, którego jeszcze nie było.
function next() {
  const unseen = items.filter((n) => !shown.has(n.link));
  if (!unseen.length) return null;
  const n = unseen[Math.floor(Math.random() * unseen.length)];
  shown.add(n.link);
  return n;
}

// Ważne wpisy nowsze niż `since` (np. z ostatniej doby), od najnowszego.
function importantSince(since) {
  return items.filter((n) => n.important && n.date && n.date >= since).sort((a, b) => b.date - a.date);
}

module.exports = { BUILTIN_FEEDS, refresh, test, next, importantSince };
