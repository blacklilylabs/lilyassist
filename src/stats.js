// Statystyki dnia (zerują się o północy). Trzymane w ustawieniach: settings.stats.
// claudeMs = jak długo dziś Claude był na wierzchu, gdy ktoś był przy komputerze (w milisekundach).
const EMPTY = { claudeMs: 0, breaks: 0, focus: 0, alerts: 0, prompts: 0, commits: 0 };

const today = () => new Date().toLocaleDateString('sv-SE'); // RRRR-MM-DD
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('sv-SE');
};

// Seria dni z rzędu (woda / kodowanie / cel). Wołamy, gdy dzisiejszy warunek został spełniony.
// Zwraca nową długość serii albo 0, jeśli dzisiejszy dzień był już policzony.
function bumpStreak(settings, key) {
  const s = settings.streaks[key] || (settings.streaks[key] = { count: 0, last: '' });
  if (s.last === today()) return 0;
  s.count = s.last === yesterday() ? s.count + 1 : 1;
  s.last = today();
  return s.count;
}

// Aktualna seria; 0, gdy przerwana (ostatni dobry dzień był wcześniej niż wczoraj).
function streakCount(settings, key) {
  const s = settings.streaks[key];
  return s && (s.last === today() || s.last === yesterday()) ? s.count : 0;
}

// Dzisiejsze statystyki (nowy dzień = nowe, puste liczniki).
function current(settings) {
  if (!settings.stats || settings.stats.date !== today()) {
    settings.stats = { date: today(), summarized: false, ...EMPTY };
  }
  // Uzupełnij brakujące liczniki (np. po aktualizacji aplikacji w ciągu dnia).
  for (const [key, zero] of Object.entries(EMPTY)) {
    if (typeof settings.stats[key] !== 'number') settings.stats[key] = zero;
  }
  return settings.stats;
}

// „1 h 25 min” / „25 min” – czas do statystyk.
function duration(ms) {
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
}

function bump(settings, key) {
  const s = current(settings);
  s[key] = (s[key] || 0) + 1;
}

module.exports = { today, current, bump, duration, bumpStreak, streakCount };
