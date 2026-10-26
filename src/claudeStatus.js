// Status Claude z oficjalnej strony statusu Anthropic (status.claude.com).
const { net } = require('electron');

const PAGE_URL = 'https://status.claude.com';
const SUMMARY_URL = `${PAGE_URL}/api/v2/summary.json`;

// Zwraca np. { indicator: 'none' | 'minor' | 'major' | 'critical', description, incidents: [...] }.
async function check() {
  const res = await net.fetch(SUMMARY_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    indicator: (data.status && data.status.indicator) || 'none',
    description: (data.status && data.status.description) || '',
    incidents: (data.incidents || []).map((i) => ({
      id: i.id,
      name: i.name,
      link: i.shortlink || PAGE_URL,
    })),
  };
}

module.exports = { PAGE_URL, check };
