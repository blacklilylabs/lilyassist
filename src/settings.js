// Ustawienia zapisywane na dysku (folder danych aplikacji: %APPDATA%\LilyAssist\settings.json).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  lang: null,           // 'pl' albo 'en'; null = według języka Windows
  introDone: false,     // czy intro przy pierwszym uruchomieniu już było
  dnd: false,          // „Nie przeszkadzaj”: ludzik pojawia się tylko przy ważnych alertach
  alerts: true,         // pokazywać ważne alerty z kanałów RSS
  keepAwake: false,     // lasso lekko rusza myszką, żeby ekran nie zgasł (domyślnie wyłączone – blokuje też blokadę ekranu)
  // Zdrowie. Woda: EFSA zaleca ok. 1,6–2,0 l napojów dziennie (2,0–2,5 l wody łącznie z jedzeniem).
  water: true,          // przypominaj o wodzie
  waterGoalMl: 2000,    // dzienny cel picia
  waterPortionMl: 200,  // jedna szklanka
  workHours: 8,         // ile godzin dziennie przy komputerze – na tyle rozkładamy cel
  breaks: true,         // przypominaj o przerwie
  breakEveryMin: 60,    // co tyle minut aktywnej pracy
  breakLengthMin: 15,   // długość przerwy
  waterLog: { date: '', ml: 0 }, // ile dziś wypite (zeruje się o północy)
  eyes: true,           // mikroprzerwy dla oczu (reguła 20-20-20)
  reminderSound: true,  // cichy dźwięk przy przypominajce o wodzie i przerwie
  // Cel dnia: date = którego dnia, done = true/false/null (nie wiadomo), asked = kiedy pytaliśmy rano,
  // checked = czy wieczorem już pytaliśmy „udało się?”.
  goal: { date: '', text: '', done: null, asked: '', checked: false },
  // Serie dni z rzędu: woda (cel picia), kodowanie (min. 15 min z Claude), cel dnia (zrobiony).
  streaks: { water: { count: 0, last: '' }, coding: { count: 0, last: '' }, goal: { count: 0, last: '' } },
  // Kodowanie.
  claudeStatus: true,   // alarmuj, gdy Claude ma awarię (status.claude.com)
  focusMin: 25,         // długość sesji „Tryb skupienia” (pomodoro)
  gitFolder: '',        // folder projektu, w którym pilnujemy commitów
  commitRemind: true,   // przypominaj o commicie…
  commitAfterMin: 60,   // …gdy zmiany czekają dłużej niż tyle minut
  customPrompts: [],    // własne szybkie prompty: { id, label, text }
  stats: null,          // statystyki dnia (patrz stats.js)
  disabledFeeds: [],    // id wyłączonych wbudowanych kanałów
  customFeeds: [],      // własne kanały: { id, name, url, alert, enabled }
  alerted: [],          // linki, o których już alarmowaliśmy (żeby się nie powtarzać)
};

const file = () => path.join(app.getPath('userData'), 'settings.json');

// Aplikacja nazywała się wcześniej CodeBuddy, OctoBuddy i OctoClaude – przenosimy
// stare ustawienia do nowego folderu (bierzemy najnowsze, które istnieją).
function migrateOldSettings() {
  const oldFile = ['CodeBuddy', 'OctoBuddy', 'octoclaude']
    .map((name) => path.join(app.getPath('appData'), name, 'settings.json'))
    .find((f) => fs.existsSync(f));
  if (fs.existsSync(file()) || !oldFile) return;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.copyFileSync(oldFile, file());
}

function load() {
  try {
    migrateOldSettings();
  } catch (err) {
    console.warn('Nie udało się przenieść starych ustawień:', err.message);
  }
  try {
    // replace: niektóre edytory (np. stary Notatnik) dopisują na początku niewidoczny znak BOM.
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8').replace(/^\uFEFF/, '')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings) {
  settings.alerted = settings.alerted.slice(-500);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(settings, null, 2));
}

module.exports = { load, save, file };
