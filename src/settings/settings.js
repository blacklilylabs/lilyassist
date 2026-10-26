// Okno ustawień: język, tryb „Nie przeszkadzaj”, alerty i kanały RSS.
const api = window.settingsApi;
const $ = (id) => document.getElementById(id);

const TEXTS = {
  pl: {
    subtitle: 'Kumpel dla osób pracujących z Claude · Black Lily Labs',
    trademark: 'Claude jest znakiem towarowym Anthropic, PBC. LilyAssist to niezależny projekt open source – nie jest powiązany z Anthropic ani przez nią wspierany.',
    langTitle: 'Język',
    modeTitle: 'Tryb',
    dnd: 'Nie przeszkadzaj',
    dndInfo: 'Ludzik się chowa i wyskakuje tylko z ważnym alertem (nowe luki, aktywne ataki, pilne komunikaty).',
    alerts: 'Ważne alerty z kanałów RSS',
    alertsInfo: 'Ważny wpis = z kanału oznaczonego jako „ważny” albo z tytułem o lukach, CVE, zero-day, ransomware, wycieku itp.',
    keepAwake: 'Nie daj zgasnąć ekranowi (lasso)',
    keepAwakeInfo: 'Gdy przez 3 minuty nie ruszasz myszą i nic nie gra, ludzik łapie kursor na lasso i lekko go przeciąga. Uwaga: wstrzymuje to też automatyczną blokadę ekranu – na komputerze służbowym lepiej wyłączyć.',
    healthTitle: 'Zdrowie',
    water: 'Przypominaj o wodzie',
    waterInfo: (min) => `Szklanka co ok. ${min} min pracy. Zalecenie EFSA dla dorosłych: ok. 1,6–2,0 l napojów dziennie. Klik w dymek = wypite.`,
    waterGoal: 'Dzienny cel',
    waterPortion: 'Szklanka',
    workHours: 'Przy komputerze dziennie',
    breaks: 'Przypominaj o przerwie',
    breaksInfo: 'Liczy się tylko czas pracy; 10+ min z dala od komputera to też przerwa. Zalecenia: rusz się choć na 2–3 min co 20–30 min siedzenia.',
    breakEvery: 'Co',
    breakLength: 'Długość przerwy',
    eyes: 'Przerwy dla oczu (20-20-20)',
    eyesInfo: 'Co 20 minut pracy krótki dymek: popatrz 20 sekund na coś daleko. Zalecają to okuliści przy pracy przy ekranie.',
    reminderSound: 'Dźwięk przypomnień',
    reminderSoundInfo: 'Cichy dźwięk przy przypominajce o wodzie („plum”) i przerwie („ding-dong”). Milczy, gdy coś gra (muzyka, film, spotkanie), a w trybie skupienia i „Nie przeszkadzaj” przypominajek i tak nie ma.',
    testWater: '▶ Posłuchaj: woda',
    testBreak: '▶ Posłuchaj: przerwa',
    promptsTitle: 'Twoje szybkie prompty',
    promptsInfo: 'Pojawią się w menu ikony w „Szybkie prompty”, pod wbudowanymi. Klik kopiuje treść do schowka i otwiera Claude.',
    noPrompts: 'Nie masz jeszcze własnych promptów.',
    promptLabel: 'Nazwa w menu (np. Przetłumacz na angielski)',
    promptText: 'Treść promptu, np. „Przetłumacz ten tekst na angielski, zachowując ton:”',
    addPrompt: 'Dodaj prompt',
    promptAdded: 'Dodano ✓ Znajdziesz go w menu ikony.',
    codingTitle: 'Kodowanie',
    claudeStatus: 'Alarmuj o awariach Claude',
    claudeStatusInfo: 'Co 5 minut sprawdzam status.claude.com. Nowa awaria = ważny alert (także w trybie „Nie przeszkadzaj”).',
    focusLength: 'Długość sesji „Tryb skupienia” (menu ikony)',
    commitRemind: 'Przypominaj o commicie',
    commitInfo: 'Wybierz folder projektu (repozytorium git). Gdy zmiany czekają za długo, ludzik przypomni o commicie i otworzy terminal w tym folderze.',
    commitAfter: 'Przypomnij, gdy zmiany czekają dłużej niż',
    pickFolder: 'Wybierz folder…',
    clearFolder: 'Wyczyść',
    noFolder: '(nie wybrano folderu)',
    folderOk: 'Folder zapisany ✓',
    builtinTitle: 'Wbudowane kanały',
    customTitle: 'Twoje kanały RSS',
    noCustom: 'Nie masz jeszcze własnych kanałów.',
    namePlaceholder: 'Nazwa (np. Zaufana Trzecia Strona)',
    importantEvery: 'ważny (każdy wpis to alert)',
    important: 'ważny',
    enabled: 'Włączony',
    remove: 'Usuń',
    add: 'Sprawdź i dodaj',
    checking: 'Sprawdzam kanał…',
    added: (n, first) => `Dodano ✓ Znalazłem ${n} wpisów, najnowszy: „${first}”`,
    failed: (msg) => `Nie udało się: ${msg}`,
    savedIn: 'Ustawienia zapisują się od razu w pliku:',
  },
  en: {
    subtitle: 'A buddy for people working with Claude · Black Lily Labs',
    trademark: 'Claude is a trademark of Anthropic, PBC. LilyAssist is an independent open-source project, not affiliated with or endorsed by Anthropic.',
    langTitle: 'Language',
    modeTitle: 'Mode',
    dnd: 'Do not disturb',
    dndInfo: 'The pet hides and only pops up with an important alert (new vulnerabilities, active attacks, urgent advisories).',
    alerts: 'Important alerts from RSS feeds',
    alertsInfo: 'Important = from a feed marked “important”, or a title about vulnerabilities, CVEs, zero-days, ransomware, breaches etc.',
    keepAwake: 'Keep the screen awake (lasso)',
    keepAwakeInfo: 'When the mouse hasn’t moved for 3 minutes and nothing is playing, the pet lassoes your cursor and tugs it gently. Note: this also prevents the automatic screen lock – better turn it off on a work computer.',
    healthTitle: 'Health',
    water: 'Water reminders',
    waterInfo: (min) => `A glass every ~${min} min of work. EFSA guidance for adults: about 1.6–2.0 L of drinks a day. Click the bubble = done.`,
    waterGoal: 'Daily goal',
    waterPortion: 'Glass',
    workHours: 'At the computer per day',
    breaks: 'Break reminders',
    breaksInfo: 'Only working time counts; 10+ min away from the computer counts as a break. Guidance: move for at least 2–3 min every 20–30 min of sitting.',
    breakEvery: 'Every',
    breakLength: 'Break length',
    eyes: 'Eye breaks (20-20-20)',
    eyesInfo: 'Every 20 minutes of work a short bubble: look at something far away for 20 seconds. Recommended by eye doctors for screen work.',
    reminderSound: 'Reminder sounds',
    reminderSoundInfo: 'A soft sound with the water reminder (“plop”) and the break reminder (“ding-dong”). Stays silent while something is playing (music, video, a call); in focus mode and Do not disturb there are no reminders anyway.',
    testWater: '▶ Listen: water',
    testBreak: '▶ Listen: break',
    promptsTitle: 'Your quick prompts',
    promptsInfo: 'They show up in the tray menu under “Quick prompts”, below the built-in ones. Click = copied to the clipboard and Claude opens.',
    noPrompts: 'You have no custom prompts yet.',
    promptLabel: 'Name in the menu (e.g. Translate to Polish)',
    promptText: 'Prompt text, e.g. “Translate this text to Polish, keeping the tone:”',
    addPrompt: 'Add prompt',
    promptAdded: 'Added ✓ You’ll find it in the tray menu.',
    codingTitle: 'Coding',
    claudeStatus: 'Alert me when Claude has an outage',
    claudeStatusInfo: 'Checks status.claude.com every 5 minutes. A new incident = an important alert (also in “Do not disturb”).',
    focusLength: '“Focus mode” session length (tray menu)',
    commitRemind: 'Commit reminders',
    commitInfo: 'Choose your project folder (a git repository). When changes wait too long, the pet reminds you to commit and opens a terminal there.',
    commitAfter: 'Remind me when changes have waited longer than',
    pickFolder: 'Choose folder…',
    clearFolder: 'Clear',
    noFolder: '(no folder chosen)',
    folderOk: 'Folder saved ✓',
    builtinTitle: 'Built-in feeds',
    customTitle: 'Your RSS feeds',
    noCustom: 'You have no custom feeds yet.',
    namePlaceholder: 'Name (e.g. Schneier on Security)',
    importantEvery: 'important (every entry is an alert)',
    important: 'important',
    enabled: 'Enabled',
    remove: 'Remove',
    add: 'Check and add',
    checking: 'Checking the feed…',
    added: (n, first) => `Added ✓ Found ${n} entries, latest: “${first}”`,
    failed: (msg) => `Couldn’t add it: ${msg}`,
    savedIn: 'Settings are saved right away to:',
  },
};

let t = TEXTS.pl;

function translate(code) {
  t = TEXTS[code] || TEXTS.pl;
  document.documentElement.lang = code;
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t[node.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => { node.placeholder = t[node.dataset.i18nPlaceholder]; });
}

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = `status ${kind}`;
}

// Komunikat błędu z procesu głównego bez technicznego prefiksu Electrona.
const cleanError = (err) => String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  children.forEach((c) => node.append(c));
  return node;
}

function feedRow(feed, { custom }) {
  const enabled = el('input', { type: 'checkbox', checked: feed.enabled, title: t.enabled });
  enabled.addEventListener('change', async () => {
    render(await api.set(custom ? { custom: { id: feed.id, enabled: enabled.checked } } : { builtin: { id: feed.id, enabled: enabled.checked } }));
  });

  const link = el('a', { href: '#', textContent: feed.url, title: feed.url });
  link.addEventListener('click', (e) => { e.preventDefault(); api.openLink(feed.url); });

  const info = el('div', { className: 'info' }, [el('span', { className: 'name', textContent: feed.name }), link]);
  const row = el('li', {}, [enabled, info]);

  if (custom) {
    const alert = el('input', { type: 'checkbox', checked: feed.alert });
    alert.addEventListener('change', async () => render(await api.set({ custom: { id: feed.id, alert: alert.checked } })));
    row.append(el('label', { className: 'inline' }, [alert, t.important]));
    const remove = el('button', { className: 'ghost', textContent: t.remove, type: 'button' });
    remove.addEventListener('click', async () => render(await api.set({ removeCustom: feed.id })));
    row.append(remove);
  } else if (feed.alert) {
    row.append(el('span', { className: 'badge', textContent: t.important }));
  }
  return row;
}

function promptRow(p) {
  const info = el('div', { className: 'info' }, [
    el('span', { className: 'name', textContent: p.label }),
    el('span', { className: 'preview', textContent: p.text.trim(), title: p.text.trim() }),
  ]);
  const remove = el('button', { className: 'ghost', textContent: t.remove, type: 'button' });
  remove.addEventListener('click', async () => render(await api.set({ removePrompt: p.id })));
  return el('li', {}, [info, remove]);
}

function render(view) {
  translate(view.lang);
  $('lang').value = view.lang;
  $('dnd').checked = view.dnd;
  $('alerts').checked = view.alerts;
  $('keepAwake').checked = view.keepAwake;
  for (const key of HEALTH_FLAGS) $(key).checked = view[key];
  for (const key of HEALTH_NUMBERS) $(key).value = view[key];
  $('water-info').textContent = t.waterInfo(view.waterEveryMin);
  $('prompt-list').replaceChildren(...view.customPrompts.map(promptRow));
  $('no-prompts').hidden = view.customPrompts.length > 0;
  $('gitFolder').textContent = view.gitFolder || t.noFolder;
  $('gitFolder').title = view.gitFolder;
  $('clear-folder').hidden = !view.gitFolder;
  $('builtin').replaceChildren(...view.builtinFeeds.map((f) => feedRow(f, { custom: false })));
  $('custom').replaceChildren(...view.customFeeds.map((f) => feedRow(f, { custom: true })));
  $('no-custom').hidden = view.customFeeds.length > 0;
  $('file').textContent = view.file;
}

$('lang').addEventListener('change', async (e) => {
  setStatus('');
  render(await api.set({ lang: e.target.value }));
});
$('dnd').addEventListener('change', async (e) => render(await api.set({ dnd: e.target.checked })));
$('alerts').addEventListener('change', async (e) => render(await api.set({ alerts: e.target.checked })));
$('keepAwake').addEventListener('change', async (e) => render(await api.set({ keepAwake: e.target.checked })));

// Zdrowie: przełączniki i liczby (zapis po zmianie pola).
const HEALTH_FLAGS = ['water', 'breaks', 'eyes', 'reminderSound', 'claudeStatus', 'commitRemind'];
const HEALTH_NUMBERS = ['waterGoalMl', 'waterPortionMl', 'workHours', 'breakEveryMin', 'breakLengthMin', 'focusMin', 'commitAfterMin'];
for (const key of HEALTH_FLAGS) {
  $(key).addEventListener('change', async (e) => render(await api.set({ [key]: e.target.checked })));
}
for (const key of HEALTH_NUMBERS) {
  $(key).addEventListener('change', async (e) => render(await api.set({ [key]: Number(e.target.value) })));
}
$('test-water').addEventListener('click', () => api.testSound('water'));
$('test-break').addEventListener('click', () => api.testSound('break'));

// Własne prompty.
$('add-prompt').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('prompt-status');
  try {
    render(await api.set({ addPrompt: { label: $('prompt-label').value, text: $('prompt-text').value } }));
    $('add-prompt').reset();
    status.textContent = t.promptAdded;
    status.className = 'status ok';
  } catch (err) {
    status.textContent = t.failed(cleanError(err));
    status.className = 'status err';
  }
});

// Menu ikony → „Dodaj własny prompt…” przewija okno do tej sekcji.
api.onScroll((section) => {
  const target = document.getElementById(section);
  if (target) target.scrollIntoView({ behavior: 'smooth' });
});

// Folder projektu do przypominajki o commicie.
function setFolderStatus(text, kind = '') {
  $('folder-status').textContent = text;
  $('folder-status').className = `status ${kind}`;
}
$('pick-folder').addEventListener('click', async () => {
  setFolderStatus('');
  try {
    const before = $('gitFolder').title;
    const { view } = await api.pickFolder();
    render(view);
    if (view.gitFolder && view.gitFolder !== before) setFolderStatus(t.folderOk, 'ok');
  } catch (err) {
    setFolderStatus(t.failed(cleanError(err)), 'err');
  }
});
$('clear-folder').addEventListener('click', async () => {
  setFolderStatus('');
  render(await api.set({ gitFolder: '' }));
});

$('add').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('add-btn').disabled = true;
  setStatus(t.checking);
  try {
    const { view, info } = await api.addFeed({
      name: $('add-name').value,
      url: $('add-url').value,
      alert: $('add-alert').checked,
    });
    render(view);
    $('add').reset();
    setStatus(t.added(info.count, info.first), 'ok');
  } catch (err) {
    setStatus(t.failed(cleanError(err)), 'err');
  } finally {
    $('add-btn').disabled = false;
  }
});

api.onChanged(render);
api.get().then(render);
