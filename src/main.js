// LilyAssist – proces główny Electrona.
// Tworzy przezroczyste okno na cały pulpit (tam biega ludzik), pilnuje,
// kiedy ludzik ma coś powiedzieć, pokazuje ważne alerty z RSS
// i obsługuje ikonę w zasobniku oraz okno ustawień.
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, powerMonitor, clipboard, dialog, globalShortcut } = require('electron');
const path = require('path');
const MESSAGES = require('./messages');
const I18N = require('./i18n');
const news = require('./news');
const store = require('./settings');
const system = require('./system');
const claudeStatus = require('./claudeStatus');
const git = require('./git');
const stats = require('./stats');
const { createTrayIcon } = require('./trayIcon');

// `npm.cmd run demo` uruchamia tryb szybki: minuta trwa wtedy sekundę.
const FAST = process.argv.includes('--fast');
const MINUTE = FAST ? 1000 : 60 * 1000;

const CONFIG = {
  idleMinutes: 10,         // po tylu minutach bezczynności: „Nuda… robimy coś?”
  funnyShare: 0.7,         // co 20 s coś mówi: 70% śmieszne, reszta pół na pół ciekawostki i newsy
  newsRefreshMinutes: 15,  // co ile minut sprawdzać kanały RSS (prawdziwe minuty)
  alertMaxAgeHours: 24,    // alarmujemy tylko o wpisach z ostatniej doby
  alertsPerRefresh: 3,     // maksymalnie tyle alertów naraz
  alertShowMinutes: 3,     // po tylu minutach nieodczytany alert sam znika
  keepAwakeMinutes: 3,     // po tylu minutach bez ruchu (i gdy nic nie gra) lasso lekko rusza myszką
  cloakMs: 2500,           // tyle trwa zakładanie peleryny niewidki przed zniknięciem
  activeIdleMinutes: 2,    // dłuższy brak ruchu = nie pracujesz (czas do wody/przerwy stoi)
  awayAsBreakMinutes: 10,  // tyle minut z dala od komputera liczy się jako przerwa
  reminderShowMinutes: 2,  // po tylu minutach nieodkliknięta przypominajka sama znika…
  snoozeMinutes: 10,       // …i wraca po tylu minutach pracy (tak samo po „✕ = później”)
  claudeStatusMinutes: 5,  // co ile minut sprawdzać status Claude (prawdziwe minuty)
  gitCheckMinutes: 5,      // co ile minut sprawdzać niezapisane zmiany w repozytorium
  commitSnoozeMinutes: 30, // „później” przy commicie = przypomnij za tyle minut
  summaryHour: 18,         // od tej godziny ludzik raz dziennie podsumowuje dzień
  goalAskFromHour: 6,      // od tej godziny rano pyta o cel dnia
  eyesEveryMinutes: 20,    // reguła 20-20-20: co 20 minut pracy popatrz 20 s w dal
  codingStreakMinutes: 15, // tyle minut z Claude = dzień liczy się do serii kodowania
  claudeUrl: 'claude://',  // otwiera aplikację Claude Desktop
  usageUrl: 'https://claude.ai/settings/usage', // limity zużycia i czas do resetu
};

let win = null;
let settingsWin = null;
let tray = null;
let settings = null;
let petVisible = true;
let idleNagged = false;
const alertQueue = [];
let currentAlert = null;
let alertTimer = null;
let introRunning = false;
let hideTimer = null;
let lastNudgeAt = 0;          // kiedy lasso ostatnio ruszyło myszką
let lastUserInputAt = Date.now();
let lassoBusyUntil = 0;
const timers = [];            // stałe timery (setInterval) – zatrzymywane przy zamykaniu
// Zdrowie: aktywny czas pracy od ostatniej wody / przerwy.
let activeSinceWaterMs = 0;
let activeSinceBreakMs = 0;
let activeSinceEyesMs = 0;
let lastHealthTickAt = Date.now();
let reminder = null;          // { kind: 'water' | 'break' | 'commit', timer }
let breakUntil = 0;
let focusUntil = 0;           // tryb skupienia (pomodoro)
let claudeState = null;       // ostatni status Claude: { indicator, description, incidents }
const seenIncidents = new Set();
let commitDirtySince = 0;     // od kiedy w repozytorium są niezapisane zmiany
let commitChanged = 0;        // ile plików się zmieniło
let commitSnoozeUntil = 0;

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Losuje tak, żeby ten sam tekst nie wrócił, zanim nie padnie połowa pozostałych.
const recent = new Map();
function pickFresh(key, list) {
  const used = recent.get(key) || [];
  const options = list.filter((x) => !used.includes(x));
  const choice = pick(options.length ? options : list);
  recent.set(key, [...used, choice].slice(-Math.floor(list.length / 2)));
  return choice;
}


// Język: wybrany w ustawieniach albo taki jak Windows (polski → pl, inny → en).
const lang = () => settings.lang || (app.getLocale().startsWith('pl') ? 'pl' : 'en');
const T = () => I18N[lang()];        // teksty menu i komunikatów
const MSG = () => MESSAGES[lang()];  // teksty dymków
const isHttp = (url) => /^https?:\/\//i.test(String(url));

// Okno z ludzikiem istnieje (przy zamykaniu aplikacji Electron je niszczy, a timery mogą jeszcze działać).
const petAlive = () => Boolean(win) && !win.isDestroyed();

function send(channel, payload) {
  if (petAlive()) win.webContents.send(channel, payload);
}

const onBreak = () => Date.now() < breakUntil;
const inFocus = () => Date.now() < focusUntil;

// Zwykłe gadanie milknie w trybie „Nie przeszkadzaj”, podczas intro, przerwy i skupienia.
const canChat = () => petVisible && !settings.dnd && !introRunning && !onBreak() && !inFocus();

// vars: wartości do podmiany w tekście, np. { min: 25 } za „{min}”.
function say(kind, { sticky = false, vars = null } = {}) {
  if (!canChat()) return;
  const text = pickFresh(`${lang()}:${kind}`, MSG()[kind]);
  send('pet:say', { text: vars ? fill(text, vars) : text, sticky });
}

// Dymek, który ma się pokazać mimo przerwy/skupienia (np. potwierdzenie kliknięcia w menu).
function sayNow(text) {
  if (petVisible && !settings.dnd) send('pet:say', { text });
}

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
const clockTime = (ms) => new Date(ms).toLocaleTimeString(T().locale, { hour: '2-digit', minute: '2-digit' });

function openClaude() {
  openUrl(CONFIG.claudeUrl);
}

// Czas z Claude: liczymy, gdy Claude jest na wierzchu, a ty jesteś przy komputerze.
let lastClaudeTickAt = Date.now();
let lastStatsSaveAt = Date.now();
function trackClaudeTime(idleMs) {
  const now = Date.now();
  const dt = Math.min(now - lastClaudeTickAt, 60000);
  lastClaudeTickAt = now;
  if (idleMs >= CONFIG.activeIdleMinutes * MINUTE || !system.isClaudeInFront()) return;
  const s = stats.current(settings);
  s.claudeMs += dt;
  // Seria kodowania: dzień liczy się po 15 minutach z Claude (bumpStreak liczy dzień tylko raz).
  if (s.claudeMs >= CONFIG.codingStreakMinutes * 60000) {
    const n = stats.bumpStreak(settings, 'coding');
    if (n) {
      store.save(settings);
      if (n > 1) say('codingStreak', { vars: { n } });
    }
  }
  if (now - lastStatsSaveAt > 60000) { // zapis na dysk najwyżej raz na minutę
    lastStatsSaveAt = now;
    store.save(settings);
  }
}

function sayFact() {
  if (!canChat()) return;
  const f = pickFresh(`${lang()}:facts`, MSG().facts);
  send('pet:say', {
    text: `💡 ${f.t}`,
    hint: MSG().factHint,
    link: MSG().wiki + encodeURIComponent(f.q),
  });
}

const shorten = (s) => (s.length > 110 ? s.slice(0, 107) + '…' : s);

function sayNews() {
  if (!canChat()) return;
  const n = news.next();
  if (!n) return sayFact();
  send('pet:say', { text: `📰 ${n.source}: ${shorten(n.title)}`, hint: MSG().newsHint, link: n.link });
}

// Co ok. 20 s (o rytm dba okno z ludzikiem): najczęściej coś śmiesznego,
// czasem ciekawostka albo news.
function sayRandom() {
  const r = Math.random();
  if (r < CONFIG.funnyShare) say('funny');
  else if (r < CONFIG.funnyShare + (1 - CONFIG.funnyShare) / 2) sayFact();
  else sayNews();
}

// ---------- Widoczność ludzika ----------

// Ludzik jest widoczny, gdy go nie schowano i nie ma trybu „Nie przeszkadzaj”
// – chyba że właśnie przyszedł ważny alert.
function updateVisibility() {
  if (!petAlive()) return;
  const show = petVisible && (!settings.dnd || currentAlert || introRunning);
  if (show) {
    clearTimeout(hideTimer);
    hideTimer = null;
    if (!win.isVisible()) win.showInactive();
    send('pet:uncloak');
  } else if (win.isVisible() && !hideTimer) {
    if (petVisible && settings.dnd) {
      // „Nie przeszkadzaj”: ludzik zarzuca pelerynę niewidkę i dopiero potem znika.
      send('pet:cloak');
      hideTimer = setTimeout(() => {
        hideTimer = null;
        if (petAlive()) win.hide();
      }, CONFIG.cloakMs);
    } else {
      win.hide();
    }
  }
}

// ---------- Ważne alerty z RSS ----------

function activeFeeds() {
  const builtin = news.BUILTIN_FEEDS.filter((f) => !settings.disabledFeeds.includes(f.id));
  const custom = settings.customFeeds.filter((f) => f.enabled && isHttp(f.url));
  return [...builtin, ...custom];
}

async function refreshNews() {
  await news.refresh(activeFeeds());
  if (!settings.alerts) return;
  const since = Date.now() - CONFIG.alertMaxAgeHours * 3600 * 1000;
  const fresh = news
    .importantSince(since)
    .filter((n) => !settings.alerted.includes(n.link) && !alertQueue.some((q) => q.link === n.link))
    .slice(0, CONFIG.alertsPerRefresh);
  if (!fresh.length) return;
  alertQueue.push(...fresh);
  settings.alerted.push(...fresh.map((n) => n.link));
  store.save(settings);
  showNextAlert();
}

function showNextAlert() {
  if (currentAlert || introRunning || !alertQueue.length || !petVisible) return;
  if (reminder) dropReminder(true); // ważny alert ma pierwszeństwo przed przypominajką
  currentAlert = alertQueue.shift();
  updateVisibility();
  send('pet:alert', {
    source: currentAlert.source,
    text: shorten(currentAlert.title),
    link: currentAlert.link,
  });
  clearTimeout(alertTimer);
  alertTimer = setTimeout(alertDone, CONFIG.alertShowMinutes * 60 * 1000);
  refreshMenu();
}

// ---------- Intro ----------

// Ludzik opowiada, co potrafi. Alerty czekają, aż skończy.
function startIntro() {
  if (introRunning || currentAlert) return;
  introRunning = true;
  updateVisibility();
  send('pet:intro');
  refreshMenu();
}

function introDone() {
  if (!introRunning) return;
  introRunning = false;
  settings.introDone = true;
  store.save(settings);
  updateVisibility();
  showNextAlert();
  refreshMenu();
}

// Alert przeczytany, zamknięty albo minął jego czas.
function alertDone() {
  if (!currentAlert) return;
  clearTimeout(alertTimer);
  currentAlert = null;
  send('pet:alert-clear');
  if (alertQueue.length) {
    setTimeout(showNextAlert, 1500);
  } else {
    // Chwilę poczekaj, żeby ludzik zdążył się pożegnać, i schowaj go w trybie „Nie przeszkadzaj”.
    setTimeout(updateVisibility, 2500);
  }
  refreshMenu();
}

// ---------- Okno z ludzikiem ----------

// Cały pulpit bez paska zadań.
const petBounds = () => screen.getPrimaryDisplay().workArea;

function createWindow() {
  win = new BrowserWindow({
    ...petBounds(),
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false, // nie zabiera fokusu oknu, w którym piszesz
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Przezroczyste okno na cały ekran Chromium czasem uznaje za „zasłonięte” i wstrzymuje
      // animację – ludzik zamierał. Wyłączamy to oszczędzanie dla okna z ludzikiem.
      backgroundThrottling: false,
      // Dźwięk przypominajki gra bez klikania w okno (okno ludzika nigdy nie dostaje fokusu).
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  // Kliknięcia przechodzą „przez” okno, dopóki kursor nie jest nad ludzikiem.
  win.setIgnoreMouseEvents(true);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: FAST ? { fast: '1' } : {} });

  win.once('ready-to-show', () => {
    send('pet:lang', lang());
    if (settings.introDone) {
      updateVisibility();
      say('greeting');
    } else {
      startIntro(); // pierwsze uruchomienie: ludzik się przedstawia
    }
  });

  // Zmiana rozdzielczości / podłączenie monitora: dopasuj okno.
  const fit = () => petAlive() && win.setBounds(petBounds());
  screen.on('display-metrics-changed', fit);
  screen.on('display-added', fit);
  screen.on('display-removed', fit);
}

// Ludzik musi wiedzieć, gdzie jest kursor (lasso, skoki, „przyłapanie” przy laptopie).
function trackCursor() {
  if (!petAlive() || !win.isVisible()) return;
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  send('pet:cursor', { x: p.x - b.x, y: p.y - b.y });
}

async function openUrl(url) {
  try {
    await shell.openExternal(url);
  } catch (err) {
    console.error('Nie udało się otworzyć:', url, err);
    say('openError');
  }
}

// Co kilka sekund sprawdzamy, czy pora coś powiedzieć.
function tick() {
  if (breakUntil && !onBreak()) endBreak();       // minął czas przerwy
  if (focusUntil && !inFocus()) endFocus(true);   // sesja skupienia zakończona
  const sysIdleMs = powerMonitor.getSystemIdleTime() * 1000;
  const idleMs = userIdleMs(sysIdleMs);
  healthTick(idleMs);
  trackClaudeTime(idleMs);
  if (!canChat()) return;
  maybeAskGoal(idleMs);
  maybeSummarizeDay();

  if (!idleNagged && idleMs >= CONFIG.idleMinutes * MINUTE) {
    idleNagged = true;
    say('bored', { sticky: true }); // dymek czeka, aż wrócisz
  } else if (idleNagged && idleMs < 3000) {
    idleNagged = false;
    say('welcomeBack');
  }

  keepScreenAwake(sysIdleMs, idleMs);
}

// ---------- Zdrowie: woda i przerwy ----------

// Ile dziś wypite (licznik zeruje się o północy).
function waterToday() {
  if (settings.waterLog.date !== stats.today()) settings.waterLog = { date: stats.today(), ml: 0 };
  return settings.waterLog.ml;
}

// Co ile minut pracy szklanka: dzienny cel rozkładamy na godziny przy komputerze.
// Np. 2000 ml / 200 ml = 10 szklanek na 8 h → co 48 minut.
function waterIntervalMin() {
  const portions = Math.max(1, settings.waterGoalMl / settings.waterPortionMl);
  return Math.min(180, Math.max(15, Math.round((settings.workHours * 60) / portions)));
}

function healthVars() {
  return {
    ml: waterToday(),
    goal: settings.waterGoalMl,
    portion: settings.waterPortionMl,
    min: settings.breakLengthMin,
  };
}

// Liczymy tylko czas, kiedy faktycznie pracujesz. Dłuższa nieobecność = przerwa.
function healthTick(idleMs) {
  const now = Date.now();
  const dt = Math.min(now - lastHealthTickAt, 60000);
  lastHealthTickAt = now;
  if (idleMs < CONFIG.activeIdleMinutes * MINUTE) {
    activeSinceWaterMs += dt;
    activeSinceBreakMs += dt;
    activeSinceEyesMs += dt;
  }
  if (idleMs >= CONFIG.awayAsBreakMinutes * MINUTE) activeSinceBreakMs = 0;
  if (idleMs >= MINUTE) activeSinceEyesMs = 0; // minuta z dala od ekranu – oczy odpoczęły

  if (!canRemind()) return;
  if (settings.water && activeSinceWaterMs >= waterIntervalMin() * MINUTE) showReminder('water');
  else if (settings.breaks && activeSinceBreakMs >= settings.breakEveryMin * MINUTE) showReminder('break');
  else if (settings.eyes && activeSinceEyesMs >= CONFIG.eyesEveryMinutes * MINUTE) {
    activeSinceEyesMs = 0;
    say('eyes'); // krótki dymek 20-20-20, bez klikania
  }
}

// Przypominajki (woda, przerwa, commit) nie przeszkadzają w ważniejszych rzeczach.
const canRemind = () => petVisible && !settings.dnd && !introRunning
  && !currentAlert && !reminder && !onBreak() && !inFocus();

function reminderContent(kind) {
  const m = MSG();
  const v = healthVars();
  if (kind === 'water') {
    return { title: `${m.waterTitle} · ${fill(m.waterProgress, v)}`, text: fill(pick(m.waterRemind), v), hint: m.waterHint };
  }
  if (kind === 'break') return { title: m.breakTitle, text: fill(pick(m.breakRemind), v), hint: m.breakHint };
  if (kind === 'goal') return { title: m.goalTitle, text: fill(m.goalAsk, { goal: settings.goal.text }), hint: m.goalHint };
  const c ={ repo: path.basename(settings.gitFolder), n: commitChanged, min: settings.commitAfterMin };
  return { title: m.commitTitle, text: fill(pick(m.commitRemind), c), hint: m.commitHint };
}

// Cichy dźwięk tylko przy wodzie i przerwie – i nie wtedy, gdy coś gra (muzyka, film, spotkanie).
// W trybie skupienia i „Nie przeszkadzaj” przypominajek i tak nie ma (canRemind).
function reminderSound(kind) {
  if (!settings.reminderSound || !['water', 'break'].includes(kind)) return null;
  try {
    if (system.isAudioPlaying()) return null;
  } catch {
    // nie udało się sprawdzić dźwięku – lepiej zagrać niż przegapić przypominajkę
  }
  return kind;
}

function showReminder(kind) {
  reminder = {
    kind,
    timer: setTimeout(() => reminderDone(kind, 'timeout'), CONFIG.reminderShowMinutes * 60 * 1000),
  };
  send('pet:reminder', { kind, sound: reminderSound(kind), ...reminderContent(kind) });
  refreshMenu();
}

// Zamyka dymek przypominajki; „później” = wróci za jakiś czas.
function dropReminder(snooze) {
  const { kind, timer } = reminder;
  clearTimeout(timer);
  reminder = null;
  send('pet:reminder-clear');
  if (!snooze) return;
  if (kind === 'water') activeSinceWaterMs = Math.max(0, (waterIntervalMin() - CONFIG.snoozeMinutes) * MINUTE);
  else if (kind === 'break') activeSinceBreakMs = Math.max(0, (settings.breakEveryMin - CONFIG.snoozeMinutes) * MINUTE);
  else if (kind === 'commit') commitSnoozeUntil = Date.now() + CONFIG.commitSnoozeMinutes * MINUTE;
}

// action: 'do' = klik w dymek (wypite / przerwa / terminal / cel zrobiony),
// 'later' = ✕, 'timeout' = nikt nie kliknął (przypomnimy później).
function reminderDone(kind, action) {
  if (!reminder || reminder.kind !== kind) return;
  dropReminder(action !== 'do');
  if (kind === 'goal') {
    goalAnswered(action === 'do' ? true : action === 'later' ? false : null);
  } else if (action === 'do') {
    if (kind === 'water') drinkWater();
    else if (kind === 'break') startBreak();
    else commitNow();
  }
  showNextAlert();
  refreshMenu();
}

function drinkWater() {
  if (reminder && reminder.kind === 'water') return reminderDone('water', 'do');
  const before = waterToday();
  settings.waterLog.ml += settings.waterPortionMl;
  store.save(settings);
  activeSinceWaterMs = 0;
  const reached = before < settings.waterGoalMl && settings.waterLog.ml >= settings.waterGoalMl;
  let text = fill(pick(reached ? MSG().waterGoal : MSG().waterDone), healthVars());
  if (reached) {
    const n = stats.bumpStreak(settings, 'water'); // seria dni z celem wody
    if (n > 1) text += ` ${fill(MSG().streakDays, { n })}`;
    store.save(settings);
  }
  sayNow(text);
  refreshMenu();
}

// ---------- Przerwa (przełącznik w menu) ----------

function startBreak() {
  if (reminder && reminder.kind === 'break') return reminderDone('break', 'do');
  if (inFocus()) endFocus(false, true);
  breakUntil = Date.now() + settings.breakLengthMin * MINUTE;
  activeSinceBreakMs = 0;
  stats.bump(settings, 'breaks');
  store.save(settings);
  sayNow(fill(pick(MSG().breakStart), healthVars()));
  send('pet:break', true);
  refreshMenu();
}

// Koniec przerwy: odznaczona w menu albo minął jej czas. Ludzik znów jest aktywny.
function endBreak() {
  if (!breakUntil) return;
  breakUntil = 0;
  activeSinceBreakMs = 0;
  send('pet:break', false);
  say('breakEnd');
  showNextAlert();
  refreshMenu();
}

// ---------- Tryb skupienia (pomodoro) ----------

function startFocus() {
  if (onBreak()) {
    breakUntil = 0;
    send('pet:break', false);
  }
  if (reminder) dropReminder(true); // przypominajki poczekają do końca sesji
  focusUntil = Date.now() + settings.focusMin * MINUTE;
  sayNow(fill(pick(MSG().focusStart), { min: settings.focusMin }));
  send('pet:focus', true);
  refreshMenu();
}

// completed = sesja trwała do końca (liczy się do statystyk). quiet = bez dymka.
function endFocus(completed, quiet = false) {
  if (!focusUntil) return;
  focusUntil = 0;
  send('pet:focus', false);
  if (completed) {
    stats.bump(settings, 'focus');
    store.save(settings);
  }
  if (!quiet) say(completed ? 'focusDone' : 'focusStop', { vars: { min: settings.focusMin } });
  refreshMenu();
}

// ---------- Status Claude ----------

async function refreshClaudeStatus() {
  if (!settings.claudeStatus) {
    claudeState = null;
    refreshMenu();
    return;
  }
  try {
    const s = await claudeStatus.check();
    const wasDown = claudeState && claudeState.indicator !== 'none';
    claudeState = s;
    // Każda nowa awaria to ważny alert (pokazuje się nawet w trybie „Nie przeszkadzaj”).
    const fresh = s.incidents.filter((i) => !seenIncidents.has(i.id));
    fresh.forEach((i) => seenIncidents.add(i.id));
    if (fresh.length) {
      alertQueue.push(...fresh.map((i) => ({ source: MSG().claudeStatusSource, title: i.name, link: i.link })));
      showNextAlert();
    }
    if (wasDown && s.indicator === 'none') say('claudeBack');
  } catch (err) {
    console.warn('Nie udało się sprawdzić statusu Claude:', err.message);
  }
  refreshMenu();
}

// ---------- Przypominajka o commicie ----------

async function checkGit() {
  const folder = settings.gitFolder;
  if (!folder || !settings.commitRemind) {
    commitDirtySince = 0;
    return;
  }
  let n;
  try {
    n = await git.changedFiles(folder);
  } catch {
    return; // folder zniknął albo git nie działa – spróbujemy następnym razem
  }
  commitChanged = n;
  if (n === 0) {
    commitDirtySince = 0;
    return;
  }
  if (!commitDirtySince) commitDirtySince = Date.now();
  const waiting = Date.now() - commitDirtySince >= settings.commitAfterMin * MINUTE;
  if (waiting && Date.now() >= commitSnoozeUntil && canRemind()) showReminder('commit');
}

// Klik w przypominajkę: terminal w folderze projektu. Kolejne przypomnienie za „commitAfterMin”.
function commitNow() {
  git.openTerminal(settings.gitFolder);
  commitDirtySince = Date.now();
  stats.bump(settings, 'commits');
  store.save(settings);
  sayNow(pick(MSG().commitOpened));
}

// ---------- Szybkie prompty i statystyki ----------

function copyPrompt(prompt) {
  clipboard.writeText(prompt.text);
  stats.bump(settings, 'prompts');
  store.save(settings);
  sayNow(pick(MSG().promptCopied));
  openClaude();
}

// ---------- Szybkie menu i skróty klawiszowe ----------

// Skróty działają w całym systemie. Na polskiej klawiaturze Ctrl+Alt = AltGr, więc nie bierzemy
// liter z ogonkami (ą, ć, ę, ł, ń, ó, ś, ź, ż). Ctrl+Alt+Spacja zajmuje zwykle Claude Desktop.
const SHORTCUTS = { menu: 'Control+Alt+P', claude: 'Control+Alt+0' };
const promptShortcut = (i) => (i < 9 ? `Control+Alt+${i + 1}` : undefined); // prompty 1–9

const menuHeader = (label) => ({ label, enabled: false });
const allPrompts = () => [...MSG().prompts, ...settings.customPrompts];

// Prompty jako pozycje menu (ze skrótami): wbudowane, potem twoje, na końcu „dodaj własny”.
function promptItems() {
  const builtin = MSG().prompts.length;
  const items = allPrompts().map((p, i) => ({
    label: p.label,
    accelerator: promptShortcut(i),
    registerAccelerator: false, // skrót tylko wyświetlamy – działa globalnie (registerShortcuts)
    click: () => copyPrompt(p),
  }));
  return [
    ...items.slice(0, builtin),
    ...(items.length > builtin ? [{ type: 'separator' }, ...items.slice(builtin)] : []),
    { type: 'separator' },
    { label: T().addPrompt, click: () => openSettings('prompts') },
  ];
}

// Szybkie menu przy kursorze: prawy klik na ludziku (bez newsa) albo Ctrl+Alt+P.
function showQuickMenu() {
  const t = T();
  const menu = Menu.buildFromTemplate([
    { label: t.openClaude, accelerator: SHORTCUTS.claude, registerAccelerator: false, click: openClaude },
    { type: 'separator' },
    menuHeader(t.prompts),
    ...promptItems(),
    { label: t.usage, click: () => openUrl(CONFIG.usageUrl) },
  ]);
  tray.popUpContextMenu(menu, screen.getCursorScreenPoint());
}

// Ctrl+Alt+P: czekamy, aż puścisz klawisze. Gdyby menu otworzyło się przy wciśniętym Alcie,
// Windows zamknąłby je w chwili puszczenia Alta (menu tylko by mignęło).
function showQuickMenuAfterKeysUp() {
  const started = Date.now();
  const waitForRelease = () => {
    if (system.modifiersHeld() && Date.now() - started < 3000) {
      setTimeout(waitForRelease, 30);
      return;
    }
    setTimeout(showQuickMenu, 50);
  };
  waitForRelease();
}

// Rejestruje skróty od nowa (po zmianie języka albo listy promptów).
function registerShortcuts() {
  globalShortcut.unregisterAll();
  const register = (accelerator, action) => {
    try {
      if (!globalShortcut.register(accelerator, action)) console.warn('Skrót zajęty przez inny program:', accelerator);
    } catch (err) {
      console.warn('Nie udało się ustawić skrótu', accelerator, err.message);
    }
  };
  register(SHORTCUTS.menu, showQuickMenuAfterKeysUp);
  register(SHORTCUTS.claude, openClaude);
  allPrompts().slice(0, 9).forEach((p, i) => register(promptShortcut(i), () => copyPrompt(p)));
}

function statsText() {
  const s = stats.current(settings);
  return fill(MSG().statsSummary, {
    time: stats.duration(s.claudeMs), ml: waterToday(), breaks: s.breaks, focus: s.focus,
    prompts: s.prompts, alerts: s.alerts, commits: s.commits,
  });
}

// Raz dziennie po 18:00: najpierw pytanie „czy cel dnia się udał?” (jeśli był), potem podsumowanie dnia.
function maybeSummarizeDay() {
  const s = stats.current(settings);
  if (s.summarized || new Date().getHours() < CONFIG.summaryHour) return;
  const g = settings.goal;
  if (g.date === stats.today() && g.text && !g.checked) {
    if (!canRemind()) return;
    g.checked = true;
    s.summarized = true;
    store.save(settings);
    showReminder('goal'); // podsumowanie pokaże się po odpowiedzi (goalAnswered)
    return;
  }
  const busy = s.claudeMs >= 60000 || s.breaks + s.focus + s.prompts + waterToday() > 0;
  if (!busy) return;
  s.summarized = true;
  store.save(settings);
  sayNow(statsText());
}

// ---------- Cel dnia ----------

let goalWin = null;

// Okienko „Co dziś budujemy?” (rano samo, albo z menu: Ustaw / zmień cel).
function openGoalWindow() {
  if (goalWin && !goalWin.isDestroyed()) {
    goalWin.show();
    goalWin.focus();
    return;
  }
  goalWin = new BrowserWindow({
    width: 460,
    height: 250,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    title: T().goalWindowTitle,
    autoHideMenuBar: true,
    backgroundColor: '#F5EBDD',
    icon: createTrayIcon(),
    webPreferences: { preload: path.join(__dirname, 'goal', 'preload.js') },
  });
  goalWin.loadFile(path.join(__dirname, 'goal', 'index.html'));
}

function closeGoalWindow() {
  if (goalWin && !goalWin.isDestroyed()) goalWin.close();
}

function saveGoal(text) {
  const clean = String(text || '').trim().slice(0, 120);
  if (!clean) return;
  settings.goal = { date: stats.today(), text: clean, done: null, asked: stats.today(), checked: false };
  store.save(settings);
  sayNow(fill(MSG().goalSaved, { goal: clean }));
  refreshMenu();
}

// Rano (od 6:00, przed 18:00) przy pierwszej aktywności ludzik pyta o cel dnia – raz dziennie.
function maybeAskGoal(idleMs) {
  const hour = new Date().getHours();
  const g = settings.goal;
  if (g.asked === stats.today() || hour < CONFIG.goalAskFromHour || hour >= CONFIG.summaryHour) return;
  if (idleMs > 60000 || currentAlert || reminder) return; // tylko gdy jesteś przy komputerze
  g.asked = stats.today();
  store.save(settings);
  openGoalWindow();
}

// Odpowiedź na „Udało się?”: true = tak, false = jeszcze nie, null = nikt nie kliknął.
function goalAnswered(done) {
  settings.goal.done = done;
  let text = '';
  if (done) {
    const n = stats.bumpStreak(settings, 'goal');
    text = pick(MSG().goalDone) + (n > 1 ? ` ${fill(MSG().streakDays, { n })}` : '');
  } else if (done === false) {
    text = pick(MSG().goalNotYet);
  }
  store.save(settings);
  if (text) sayNow(text);
  setTimeout(() => sayNow(statsText()), text ? 6000 : 0); // a potem podsumowanie dnia
}

// Ile czasu minęło od ostatniego ruchu myszą lub klawisza TWOJEGO
// (ruchy myszki zrobione przez lasso się nie liczą).
function userIdleMs(sysIdleMs) {
  const lastInput = Date.now() - sysIdleMs;
  if (lastInput > lastNudgeAt + 2500) lastUserInputAt = Math.max(lastUserInputAt, lastInput);
  return Date.now() - lastUserInputAt;
}

// „Budzik ekranu”: gdy przez 3 minuty nikt nie rusza myszą i nic nie gra,
// ludzik łapie kursor na lasso i lekko go przeciąga – ekran nie zgaśnie.
function keepScreenAwake(sysIdleMs, idleMs) {
  const limit = CONFIG.keepAwakeMinutes * MINUTE;
  if (!settings.keepAwake || currentAlert || reminder || Date.now() < lassoBusyUntil) return;
  if (sysIdleMs < limit || idleMs < limit) return;
  if (system.isAudioPlaying()) return; // film czy muzyka i tak trzymają ekran – nie przeszkadzamy
  lassoBusyUntil = Date.now() + 20000;
  send('pet:lasso-awake');
}

// ---------- Okno ustawień ----------

// section = id sekcji, do której przewinąć (np. 'prompts').
function openSettings(section) {
  const target = typeof section === 'string' ? section : '';
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    if (target) settingsWin.webContents.send('settings:scroll', target);
    return;
  }
  settingsWin = new BrowserWindow({
    width: 620,
    height: 720,
    title: T().settingsTitle,
    autoHideMenuBar: true,
    backgroundColor: '#F5EBDD',
    icon: createTrayIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'settings', 'preload.js'),
    },
  });
  settingsWin.loadFile(path.join(__dirname, 'settings', 'index.html'), target ? { hash: target } : {});
}

function settingsView() {
  return {
    lang: lang(),
    dnd: settings.dnd,
    alerts: settings.alerts,
    keepAwake: settings.keepAwake,
    water: settings.water,
    waterGoalMl: settings.waterGoalMl,
    waterPortionMl: settings.waterPortionMl,
    workHours: settings.workHours,
    waterEveryMin: waterIntervalMin(),
    breaks: settings.breaks,
    eyes: settings.eyes,
    reminderSound: settings.reminderSound,
    breakEveryMin: settings.breakEveryMin,
    breakLengthMin: settings.breakLengthMin,
    claudeStatus: settings.claudeStatus,
    focusMin: settings.focusMin,
    gitFolder: settings.gitFolder,
    commitRemind: settings.commitRemind,
    commitAfterMin: settings.commitAfterMin,
    builtinFeeds: news.BUILTIN_FEEDS.map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url || 'https://news.ycombinator.com',
      alert: Boolean(f.alert),
      enabled: !settings.disabledFeeds.includes(f.id),
    })),
    customFeeds: settings.customFeeds,
    customPrompts: settings.customPrompts,
    file: store.file(),
  };
}

// Zmiana z okna ustawień. Przyjmujemy tylko znane pola.
function applySettings(change) {
  if (change.lang === 'pl' || change.lang === 'en') setLang(change.lang);
  if (typeof change.dnd === 'boolean') setDnd(change.dnd);
  if (typeof change.alerts === 'boolean') settings.alerts = change.alerts;
  if (typeof change.keepAwake === 'boolean') settings.keepAwake = change.keepAwake;
  // Zdrowie i kodowanie: przełączniki i liczby (z rozsądnymi granicami).
  for (const key of ['water', 'breaks', 'eyes', 'reminderSound', 'claudeStatus', 'commitRemind']) {
    if (typeof change[key] === 'boolean') settings[key] = change[key];
  }
  if (change.gitFolder === '') {
    settings.gitFolder = '';
    commitDirtySince = 0;
  }
  const LIMITS = {
    waterGoalMl: [500, 5000],
    waterPortionMl: [50, 1000],
    workHours: [1, 16],
    breakEveryMin: [15, 240],
    breakLengthMin: [1, 60],
    focusMin: [5, 120],
    commitAfterMin: [10, 480],
  };
  for (const [key, [lo, hi]] of Object.entries(LIMITS)) {
    const v = Number(change[key]);
    if (change[key] !== undefined && Number.isFinite(v)) settings[key] = Math.min(hi, Math.max(lo, Math.round(v)));
  }
  if (change.builtin && typeof change.builtin.id === 'string') {
    const { id, enabled } = change.builtin;
    settings.disabledFeeds = settings.disabledFeeds.filter((x) => x !== id);
    if (!enabled) settings.disabledFeeds.push(id);
  }
  if (change.custom && typeof change.custom.id === 'string') {
    const feed = settings.customFeeds.find((f) => f.id === change.custom.id);
    if (feed) {
      if (typeof change.custom.enabled === 'boolean') feed.enabled = change.custom.enabled;
      if (typeof change.custom.alert === 'boolean') feed.alert = change.custom.alert;
    }
  }
  if (typeof change.removeCustom === 'string') {
    settings.customFeeds = settings.customFeeds.filter((f) => f.id !== change.removeCustom);
  }
  // Własne szybkie prompty: nazwa (do menu) i treść.
  if (change.addPrompt) {
    const label = String(change.addPrompt.label || '').trim().slice(0, 40);
    const text = String(change.addPrompt.text || '').trim().slice(0, 4000);
    if (!label || !text) throw new Error(T().errPrompt);
    settings.customPrompts.push({ id: `prompt-${Date.now()}`, label, text: `${text}\n\n` });
  }
  if (typeof change.removePrompt === 'string') {
    settings.customPrompts = settings.customPrompts.filter((p) => p.id !== change.removePrompt);
  }
  if (change.addPrompt || change.removePrompt) registerShortcuts(); // Ctrl+Alt+1…9 dla nowej listy
  store.save(settings);
  refreshMenu();
  if (change.builtin || change.custom || change.removeCustom || change.alerts) refreshNews();
  if (typeof change.claudeStatus === 'boolean') refreshClaudeStatus();
  return settingsView();
}

// Wybór folderu projektu do przypominajki o commicie (musi być repozytorium git).
async function pickGitFolder() {
  const result = await dialog.showOpenDialog(settingsWin, { title: T().pickFolder, properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return { view: settingsView() };
  const folder = result.filePaths[0];
  try {
    await git.changedFiles(folder);
  } catch {
    throw new Error(T().errNotRepo);
  }
  settings.gitFolder = folder;
  commitDirtySince = 0;
  store.save(settings);
  checkGit();
  return { view: settingsView() };
}

async function addCustomFeed({ name, url, alert }) {
  url = String(url || '').trim();
  if (!isHttp(url)) throw new Error(T().errUrl);
  if (settings.customFeeds.some((f) => f.url === url)) throw new Error(T().errDuplicate);
  const info = await news.test(url).catch((err) => {
    throw err.code === 'NO_ITEMS' ? new Error(T().errNoItems) : err;
  });
  settings.customFeeds.push({
    id: `custom-${Date.now()}`,
    name: String(name || '').trim().slice(0, 40) || new URL(url).hostname,
    url,
    alert: Boolean(alert),
    enabled: true,
  });
  store.save(settings);
  refreshNews();
  return { view: settingsView(), info };
}

// ---------- Zasobnik systemowy ----------

// W trybie deweloperskim autostart musi uruchamiać electron.exe z folderem projektu.
function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function autostartEnabled() {
  return app.getLoginItemSettings(loginItemOptions()).openAtLogin;
}

function setLang(code) {
  settings.lang = code;
  store.save(settings);
  send('pet:lang', code);
  tray.setToolTip(T().tooltip);
  registerShortcuts(); // prompty mają teraz treść w nowym języku
  refreshMenu();
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.setTitle(T().settingsTitle);
    settingsWin.webContents.send('settings:changed', settingsView());
  }
}

function setDnd(on) {
  settings.dnd = on;
  store.save(settings);
  updateVisibility();
  refreshMenu();
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('settings:changed', settingsView());
}

// Menu ikony w sekcjach: STATUS (tylko do czytania), CLAUDE, ZDROWIE, TRYBY, LUDZIK, APLIKACJA.
// Budujemy je od nowa przy każdym otwarciu, więc liczby (czas z Claude, woda) są zawsze aktualne.
let trayMenu = null;

function refreshMenu() {
  if (!tray) return;
  const t = T();
  const awake = petVisible && !settings.dnd;
  const header = (label) => ({ label, enabled: false });
  const today = stats.current(settings);

  // STATUS: status Claude (klik = strona statusu), woda, czas z Claude, statystyki.
  const status = [header(t.secStatus)];
  if (settings.claudeStatus) {
    status.push({
      label: claudeState ? t.claudeStatus(claudeState.indicator === 'none', claudeState.description) : t.claudeStatusUnknown,
      click: () => openUrl(claudeStatus.PAGE_URL),
    });
  }
  status.push(
    header(t.waterToday(waterToday(), settings.waterGoalMl)),
    header(t.timeToday(stats.duration(today.claudeMs))),
    // Cel dnia: klik = ustaw albo zmień.
    settings.goal.date === stats.today() && settings.goal.text
      ? { label: t.goalLine(shorten(settings.goal.text).slice(0, 45), settings.goal.done === true), click: openGoalWindow }
      : { label: t.goalSet, click: openGoalWindow },
    header(t.streaks(
      stats.streakCount(settings, 'water'),
      stats.streakCount(settings, 'coding'),
      stats.streakCount(settings, 'goal'),
    )),
    {
      label: t.statsMenu,
      submenu: [
        ...t.stats(today, waterToday(), stats.duration(today.claudeMs)).map(header),
        { type: 'separator' },
        { label: t.statsSay, click: () => sayNow(statsText()) },
      ],
    },
  );

  trayMenu = Menu.buildFromTemplate([
    header(`LilyAssist · ${t.tagline}`),
    { type: 'separator' },
    ...status,
    { type: 'separator' },
    header(t.secClaude),
    { label: t.openClaude, accelerator: SHORTCUTS.claude, registerAccelerator: false, click: openClaude },
    { label: t.prompts, submenu: promptItems() },
    { label: t.quickMenu, accelerator: SHORTCUTS.menu, registerAccelerator: false, click: showQuickMenu },
    { label: t.usage, click: () => openUrl(CONFIG.usageUrl) },
    { type: 'separator' },
    header(t.secHealth),
    { label: t.drink(settings.waterPortionMl), click: drinkWater },
    {
      label: onBreak() ? t.breakOn(clockTime(breakUntil)) : t.breakToggle(settings.breakLengthMin),
      type: 'checkbox',
      checked: onBreak(),
      click: (item) => (item.checked ? startBreak() : endBreak()),
    },
    {
      label: t.reminderSound,
      type: 'checkbox',
      checked: settings.reminderSound,
      click: (item) => {
        settings.reminderSound = item.checked;
        store.save(settings);
        if (item.checked) send('pet:sound', 'water'); // od razu słychać, jak to brzmi
      },
    },
    { type: 'separator' },
    header(t.secModes),
    {
      label: inFocus() ? t.focusOn(clockTime(focusUntil)) : t.focusToggle(settings.focusMin),
      type: 'checkbox',
      checked: inFocus(),
      click: (item) => (item.checked ? startFocus() : endFocus(false)),
    },
    { label: t.dnd, type: 'checkbox', checked: settings.dnd, click: (item) => setDnd(item.checked) },
    {
      label: t.keepAwake,
      type: 'checkbox',
      checked: settings.keepAwake,
      click: (item) => applySettings({ keepAwake: item.checked }),
    },
    { type: 'separator' },
    header(t.secPet),
    {
      label: t.sayMenu,
      enabled: awake,
      submenu: [
        { label: t.sayFunny, click: () => say('funny') },
        { label: t.sayFact, click: sayFact },
        { label: t.sayNews, click: sayNews },
      ],
    },
    { label: t.intro, click: startIntro, enabled: petVisible && !introRunning && !currentAlert },
    {
      label: t.showPet,
      type: 'checkbox',
      checked: petVisible,
      click: (item) => {
        petVisible = item.checked;
        updateVisibility();
        if (petVisible) showNextAlert();
      },
    },
    { type: 'separator' },
    header(t.secApp),
    {
      label: t.autostart,
      type: 'checkbox',
      checked: autostartEnabled(),
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, ...loginItemOptions() }),
    },
    {
      label: t.language,
      submenu: [
        { label: 'Polski', type: 'radio', checked: lang() === 'pl', click: () => setLang('pl') },
        { label: 'English', type: 'radio', checked: lang() === 'en', click: () => setLang('en') },
      ],
    },
    { label: t.settings, click: () => openSettings() },
    { label: t.quit, click: () => app.quit() },
  ]);
}

function showTrayMenu() {
  refreshMenu();
  tray.popUpContextMenu(trayMenu);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(T().tooltip);
  tray.on('click', showTrayMenu);
  tray.on('right-click', showTrayMenu);
  refreshMenu();
}

// ---------- Start ----------

// Tylko jeden ludzik naraz. Drugie uruchomienie otwiera ustawienia.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('com.blacklilylabs.lilyassist');
  app.on('second-instance', openSettings);

  ipcMain.on('pet:hover', (_e, over) => {
    if (petAlive()) win.setIgnoreMouseEvents(!over);
  });
  ipcMain.on('pet:open-claude', openClaude);
  ipcMain.on('pet:open-link', (_e, url) => {
    // Otwieramy tylko zwykłe strony WWW.
    if (!isHttp(url)) return;
    if (currentAlert && url === currentAlert.link) {
      stats.bump(settings, 'alerts');
      store.save(settings);
    }
    openUrl(url);
  });
  ipcMain.on('pet:alert-done', alertDone);
  ipcMain.on('pet:intro-done', introDone);
  // Lasso szarpie myszką: najwyżej kilka pikseli naraz.
  ipcMain.on('pet:tug', (_e, dx, dy) => {
    if (!settings.keepAwake) return;
    const small = (v) => Math.max(-8, Math.min(8, Math.round(Number(v) || 0)));
    lastNudgeAt = Date.now();
    system.nudgeMouse(small(dx), small(dy));
  });
  ipcMain.on('pet:lasso-done', () => { lassoBusyUntil = 0; });
  ipcMain.on('pet:reminder-done', (_e, kind, action) => {
    if (['water', 'break', 'commit', 'goal'].includes(kind) && ['do', 'later'].includes(action)) reminderDone(kind, action);
  });
  ipcMain.on('pet:want-talk', () => {
    if (!idleNagged) sayRandom(); // gdy dymek „Nuda…” czeka na ciebie, nie przykrywamy go
  });
  ipcMain.on('pet:quick-menu', showQuickMenu); // prawy klik na ludziku (bez newsa)

  ipcMain.handle('settings:get', () => settingsView());
  ipcMain.handle('settings:set', (_e, change) => applySettings(change || {}));
  ipcMain.handle('settings:add-feed', (_e, feed) => addCustomFeed(feed || {}));
  ipcMain.handle('settings:open-link', (_e, url) => isHttp(url) && openUrl(url));
  ipcMain.handle('settings:pick-folder', pickGitFolder);
  // „Posłuchaj” w ustawieniach: dźwięk gra okno ludzika (to samo, co przy przypominajce).
  ipcMain.handle('settings:test-sound', (_e, kind) => ['water', 'break'].includes(kind) && send('pet:sound', kind));
  ipcMain.handle('goal:get', () => ({
    lang: lang(),
    text: settings.goal.date === stats.today() ? settings.goal.text : '',
  }));
  ipcMain.handle('goal:save', (_e, text) => {
    saveGoal(text);
    closeGoalWindow();
  });
  ipcMain.handle('goal:close', closeGoalWindow);

  // Tylko w trybie demo: furtka do ręcznego testowania przypominajek i trybów.
  if (FAST) {
    global.octoDebug = {
      showReminder, drinkWater, startBreak, endBreak, startFocus, endFocus, refreshClaudeStatus, checkGit,
      copyPrompt, sayStats: () => sayNow(statsText()), modules: { claudeStatus, git },
      setGitFolder: (folder) => { settings.gitFolder = folder; commitDirtySince = 0; },
      trackClaudeTime, openGoalWindow, saveGoal, maybeSummarizeDay, showQuickMenu,
      goal: () => ({ goal: settings.goal, streaks: settings.streaks, summarized: stats.current(settings).summarized }),
      resetSummary: () => { stats.current(settings).summarized = false; settings.goal.checked = false; },
      shortcuts: () => ['Control+Alt+P', 'Control+Alt+0', 'Control+Alt+1', 'Control+Alt+8'].map((a) => `${a}=${globalShortcut.isRegistered(a)}`),
      // Etykiety menu ikony (z podmenu w nawiasach) – do sprawdzenia, jak wygląda.
      menu: () => {
        refreshMenu();
        const labels = (items) => items.map((i) => (i.type === 'separator' ? '---'
          : i.submenu ? `${i.label} [${labels(i.submenu.items).join(' | ')}]`
            : `${i.type === 'checkbox' ? (i.checked ? '[x] ' : '[ ] ') : ''}${i.label}`));
        return labels(trayMenu.items);
      },
      state: () => ({
        reminder: reminder && reminder.kind, onBreak: onBreak(), inFocus: inFocus(),
        claude: claudeState && claudeState.indicator, commitChanged, commitDirtySince,
        stats: stats.current(settings), water: settings.waterLog,
      }),
    };
  }

  app.whenReady().then(() => {
    settings = store.load();
    createWindow();
    createTray();
    registerShortcuts();
    timers.push(
      setInterval(tick, FAST ? 1000 : 5000),
      setInterval(trackCursor, 33),
      setInterval(refreshNews, CONFIG.newsRefreshMinutes * 60 * 1000),
      setInterval(refreshClaudeStatus, CONFIG.claudeStatusMinutes * 60 * 1000),
      setInterval(checkGit, CONFIG.gitCheckMinutes * MINUTE),
    );
    refreshNews();
    refreshClaudeStatus();
    checkGit();
  });

  // Okno z ludzikiem jest zawsze otwarte; aplikację zamyka się z menu w zasobniku.
  app.on('window-all-closed', (e) => e.preventDefault());
  // Zamykanie: najpierw zatrzymujemy wszystkie timery, żeby nie sięgały do niszczonych okien.
  app.on('before-quit', () => {
    timers.forEach(clearInterval);
    timers.length = 0;
    clearTimeout(hideTimer);
    clearTimeout(alertTimer);
    if (reminder) clearTimeout(reminder.timer);
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
