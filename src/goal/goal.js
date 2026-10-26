// Okienko „Cel dnia”: jedno zdanie, co dziś budujesz. Enter = zapisz, Esc = nie dziś.
const api = window.goalApi;
const $ = (id) => document.getElementById(id);

const TEXTS = {
  pl: {
    title: '🎯 Co dziś budujemy?',
    info: 'Jeden konkretny cel na dziś. Wieczorem zapytam, czy się udało.',
    placeholder: 'np. dokończyć formularz logowania',
    save: 'Zapisz cel',
    skip: 'Nie dziś',
  },
  en: {
    title: '🎯 What are we building today?',
    info: 'One concrete goal for today. In the evening I’ll ask if you made it.',
    placeholder: 'e.g. finish the login form',
    save: 'Save goal',
    skip: 'Not today',
  },
};

api.get().then(({ lang, text }) => {
  const t = TEXTS[lang] || TEXTS.pl;
  document.documentElement.lang = lang;
  $('title').textContent = t.title;
  $('info').textContent = t.info;
  $('text').placeholder = t.placeholder;
  $('text').value = text || '';
  $('save').textContent = t.save;
  $('skip').textContent = t.skip;
  $('text').focus();
});

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('text').value.trim();
  if (text) api.save(text);
});
$('skip').addEventListener('click', () => api.close());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') api.close();
});
