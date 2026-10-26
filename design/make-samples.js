// Generuje stronę z próbkami postaci LilyAssist (design/lilyassist-probki.html) – wektorowe SVG,
// bez JavaScriptu na stronie (animacje w CSS), żeby działała w każdym podglądzie.
// Uruchom: node design/make-samples.js
const fs = require('fs');
const path = require('path');

const P = '#3B2230'; // śliwka
const G = '#C8892A'; // złoto
const C = '#F5EBDD'; // krem
const D = '#9C6518'; // ciemne złoto
const BLUSH = '#E8798F';

const FLASK = 'M41 9H59V36L88 84Q94 96 80 98H20Q6 96 12 84L41 36Z';
const petal = 'M0 0C6-6 6-15 0-22C-6-15-6-6 0 0Z';

// Lilia z logo (6 płatków, środek śliwka + złoto).
const lily = (x, y, s, outline = '') => `
  <g transform="translate(${x} ${y}) scale(${s})">
    ${[0, 60, 120, 180, 240, 300].map((r) => `<path transform="rotate(${r})" d="${petal}" fill="${C}" ${outline}/>`).join('')}
    <circle r="4.5" fill="${P}"/><circle r="3.2" fill="${G}"/>
  </g>`;

const sparkle = (x, y, s) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0-6L1.5-1.5L6 0L1.5 1.5L0 6L-1.5 1.5L-6 0L-1.5-1.5Z" fill="${G}" stroke="${P}" stroke-width=".8"/>`;

// Nóżki z bucikami (każda podskakuje na zmianę) – wspólne dla kolb.
const feet = (shoe) => `
  <g class="stepA"><path d="M38 95V109" stroke="${P}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="35" cy="111" rx="7.5" ry="4.2" fill="${shoe}" stroke="${P}" stroke-width="2"/></g>
  <g class="stepB"><path d="M62 95V109" stroke="${P}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="65" cy="111" rx="7.5" ry="4.2" fill="${shoe}" stroke="${P}" stroke-width="2"/></g>`;

// Rączki: lewa luźno, prawa macha.
const arms = (arm, glove) => `
  <path d="M23 68Q11 73 7 62" stroke="${arm}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
  <circle cx="6" cy="58.5" r="5.2" fill="${glove}" stroke="${P}" stroke-width="2"/>
  <g class="wave" style="transform-origin:77px 68px">
    <path d="M77 68Q91 62 93 49" stroke="${arm}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
    <circle cx="93.5" cy="45" r="5.2" fill="${glove}" stroke="${P}" stroke-width="2"/>
  </g>`;

// 1A – dopracowany szkic Łukasza: kremowa kolba, lilia na brzuszku, szeroki uśmiech, rączki w górze.
function flaskSketch(id, w) {
  const limbs = (color, extra) => `
    <g stroke="${color}" fill="${color}" stroke-width="${extra}" stroke-linejoin="round">
      <rect x="32" y="90" width="11" height="16" rx="5.5"/><ellipse cx="35" cy="107" rx="9" ry="5"/>
      <rect x="57" y="90" width="11" height="16" rx="5.5"/><ellipse cx="65" cy="107" rx="9" ry="5"/>
      <g class="cheerL" style="transform-origin:24px 66px">
        <path d="M24 66L10 53" stroke-width="${6 + extra}" stroke-linecap="round" fill="none"/>
        <circle cx="8" cy="50" r="5.5"/><circle cx="2.5" cy="46" r="2.8"/><circle cx="6.5" cy="42.5" r="2.8"/><circle cx="12" cy="43.5" r="2.8"/>
      </g>
      <g class="cheerR" style="transform-origin:76px 66px">
        <path d="M76 66L90 53" stroke-width="${6 + extra}" stroke-linecap="round" fill="none"/>
        <circle cx="92" cy="50" r="5.5"/><circle cx="97.5" cy="46" r="2.8"/><circle cx="93.5" cy="42.5" r="2.8"/><circle cx="88" cy="43.5" r="2.8"/>
      </g>
    </g>`;
  return `<svg width="${w}" viewBox="-12 -6 124 126" class="char">
  <g class="bob">
    ${limbs(P, 4)}
    ${limbs(C, 0)}
    <path d="${FLASK}" fill="${C}" stroke="${P}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="34" y="0" width="32" height="9" rx="3" fill="${C}" stroke="${P}" stroke-width="2.5"/>
    <path d="M41 9.5H59" stroke="${C}" stroke-width="3"/>
    <path d="M37 44Q42 40.5 47 43" stroke="${P}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M53 43Q58 40.5 63 44" stroke="${P}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <g class="blink" style="transform-origin:50px 52.5px">
      <circle cx="42" cy="52" r="3.8" fill="${G}"/><circle cx="58" cy="53" r="3.8" fill="${G}"/>
      <circle cx="41.3" cy="52.5" r="1.8" fill="${P}"/><circle cx="57.3" cy="53.5" r="1.8" fill="${P}"/>
      <circle cx="43" cy="50.8" r=".9" fill="#fff"/><circle cx="59" cy="51.8" r=".9" fill="#fff"/>
    </g>
    <path d="M37 59.5Q50 57.5 63 59.5Q62 71 50 72Q38 71 37 59.5Z" fill="${P}"/>
    <path d="M40 60Q50 58.7 60 60V61.8Q50 60.5 40 61.8Z" fill="#fff"/>
    <ellipse cx="50" cy="68.5" rx="6" ry="2.7" fill="${BLUSH}"/>
    <g class="sway" style="transform-origin:50px 85px">
      <g transform="translate(50 85) scale(.53)">
        ${[0, 60, 120, 180, 240, 300].map((r) => `<path transform="rotate(${r})" d="${petal}" fill="${P}"/>`).join('')}
        <circle r="5.5" fill="${C}"/><circle r="3.8" fill="${G}"/>
      </g>
    </g>
  </g></svg>`;
}

// 1B – szklana kolba ze złotym płynem i lilią w środku.
function flaskGlass(id, w) {
  return `<svg width="${w}" viewBox="-8 -2 116 122" class="char">
  <defs><clipPath id="clip${id}"><path d="${FLASK}"/></clipPath></defs>
  <g class="bob">
    ${feet(G)}
    ${arms(P, C)}
    <path d="${FLASK}" fill="#FFFBF5"/>
    <g clip-path="url(#clip${id})">
      <g class="slosh"><path d="M-40 66Q-30 62-20 66T0 66T20 66T40 66T60 66T80 66T100 66T120 66T140 66V110H-40Z" fill="${G}"/></g>
      <path d="M0 90Q50 96 100 90V110H0Z" fill="${D}" opacity=".45"/>
      <circle cx="30" cy="78" r="1.6" fill="${C}"/><circle cx="71" cy="75" r="1.3" fill="${C}"/><circle cx="64" cy="89" r="1.8" fill="${C}"/>
      ${lily(50, 82, 0.5)}
    </g>
    <path d="${FLASK}" fill="none" stroke="${P}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M37 42L25 63" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>
    <path d="M45 14V29" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>
    <rect x="35" y="1" width="30" height="9" rx="3" fill="${P}"/><rect x="35" y="6.2" width="30" height="1.8" fill="${G}"/>
    <ellipse cx="44" cy="50" rx="3" ry="3.8" fill="${P}"/><ellipse cx="56" cy="50" rx="3" ry="3.8" fill="${P}"/>
    <circle cx="45" cy="48.6" r="1.1" fill="#fff"/><circle cx="57" cy="48.6" r="1.1" fill="#fff"/>
    <path d="M46 56Q50 59.5 54 56" stroke="${P}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="39" cy="56" rx="3" ry="1.6" fill="${BLUSH}" opacity=".55"/><ellipse cx="61" cy="56" rx="3" ry="1.6" fill="${BLUSH}" opacity=".55"/>
  </g></svg>`;
}

// 1B – kolba dokładnie jak w logo (śliwka + lilia), z buzią.
function flaskLogo(id, w) {
  return `<svg width="${w}" viewBox="-8 -2 116 122" class="char">
  <g class="bob">
    ${feet(G)}
    ${arms(P, G)}
    <path d="${FLASK}" fill="${P}"/>
    <path d="M37 42L25 63" stroke="#6B4A5C" stroke-width="3" stroke-linecap="round"/>
    <rect x="34" y="0" width="32" height="9" rx="3" fill="${P}"/>
    ${lily(50, 76, 0.75)}
    <ellipse cx="44" cy="46.5" rx="4" ry="4.6" fill="${C}"/><ellipse cx="56" cy="46.5" rx="4" ry="4.6" fill="${C}"/>
    <circle cx="44.6" cy="47.6" r="2.3" fill="${P}"/><circle cx="56.6" cy="47.6" r="2.3" fill="${P}"/>
    <circle cx="45.3" cy="46.6" r=".8" fill="#fff"/><circle cx="57.3" cy="46.6" r=".8" fill="#fff"/>
    <path d="M46.5 53.5Q50 56.5 53.5 53.5" stroke="${C}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </g></svg>`;
}

// 2 – logo (bez zmian) i wychodzący z niego dżin. body/accent – kolory dżina.
function genie(id, w, body, accent) {
  const shape = (color, extra) => `
    <g stroke="${color}" fill="none" stroke-linecap="round">
      <path d="M100 96Q84 108 92 120" stroke-width="${26 + extra}"/>
      <path d="M92 120Q100 132 102 140" stroke-width="${18 + extra}"/>
      <path d="M102 140Q101 147 100 153" stroke-width="${11 + extra}"/>
      <g class="wave" style="transform-origin:80px 76px"><path d="M82 77Q64 72 60 57" stroke-width="${9 + extra}"/></g>
      <path d="M118 77Q140 82 142 67" stroke-width="${9 + extra}"/>
    </g>
    <path d="M76 98C72 80 78 62 100 60C122 62 128 80 124 98Q100 106 76 98Z" fill="${color}" stroke="${color}" stroke-width="${extra}" stroke-linejoin="round"/>
    <circle cx="100" cy="44" r="20" fill="${color}" stroke="${color}" stroke-width="${extra}"/>`;
  return `<svg width="${w}" viewBox="30 4 140 248" class="char">
  <g class="float">
    ${shape(P, 6)}
    ${shape(body, 0)}
    <path d="M80 90Q100 98 120 90" stroke="${accent}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="100" cy="95" r="3.4" fill="${accent}" stroke="${P}" stroke-width="1.2"/>
    <g class="wave" style="transform-origin:80px 76px"><circle cx="59" cy="52" r="7" fill="${C}" stroke="${P}" stroke-width="3"/></g>
    <circle cx="142" cy="62" r="7" fill="${C}" stroke="${P}" stroke-width="3"/>
    <g class="twinkle">${sparkle(154, 48, 1)}${sparkle(160, 68, .7)}${sparkle(148, 34, .55)}</g>
    ${lily(100, 23, 0.42, `stroke="${P}" stroke-width="2.5"`)}
    <path d="M88.5 37.5Q92.5 35 96 37" stroke="${P}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M104 37Q107.5 35 111.5 37.5" stroke="${P}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="93" cy="45" rx="2.8" ry="3.6" fill="${P}"/><ellipse cx="107" cy="45" rx="2.8" ry="3.6" fill="${P}"/>
    <circle cx="94" cy="43.7" r="1" fill="#fff"/><circle cx="108" cy="43.7" r="1" fill="#fff"/>
    <path d="M93.5 51.5Q100 57.5 106.5 51.5" stroke="${P}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="87.5" cy="51" rx="3" ry="1.6" fill="${BLUSH}" opacity=".6"/><ellipse cx="112.5" cy="51" rx="3" ry="1.6" fill="${BLUSH}" opacity=".6"/>
  </g>
  <g transform="translate(45 140) scale(1.1)">
    <path d="${FLASK}" fill="${P}"/>
    ${lily(50, 72, 1)}
  </g>
  <g class="pop"><g transform="translate(131 131) rotate(28)"><rect x="-17.6" y="-5" width="35.2" height="10" rx="3.3" fill="${P}"/></g></g>
  </svg>`;
}

const IDEAS = [
  {
    title: 'Pomysł 1 – kolba z rączkami i nóżkami',
    lead: 'Na bazie Twojego szkicu, narysowane wektorowo: gładkie kształty, obrys, żeby postać nie ginęła na żadnym tle.',
    cards: [
      { key: '1A', name: 'Kolba z Twojego szkicu', tag: 'Twój szkic, dopracowany', draw: flaskSketch, big: 200, small: 60, stage: 'plum',
        pros: ['Kremowa kolba, lilia z logo na brzuszku (jak w 1B), złote oczy, brwi i szeroki uśmiech.', 'Rączki w górze („hura!”), krótkie nóżki, lilia lekko się kołysze.', 'Cienki śliwkowy obrys – widać ją też na jasnym pulpicie.'] },
      { key: '1B', name: 'Szklana kolba z płynem', tag: 'wersja „labowa”', draw: flaskGlass, big: 210, small: 64,
        pros: ['Szkło z odblaskiem, złoty płyn się buja, w płynie pływa lilia z logo.', 'Śliwkowy obrys – widać ją na ciemnym i jasnym pulpicie.'] },
      { key: '1C', name: 'Kolba jak w logo', tag: 'najwierniejsza logo', draw: flaskLogo, big: 210, small: 64,
        pros: ['Dokładnie kształt i kolory logo, tylko z oczkami, rączkami i nóżkami.', 'Na ciemnym pulpicie trochę ginie (śliwka na ciemnym).'] },
    ],
  },
  {
    title: 'Pomysł 2 – logo, z którego wychodzi dżin',
    lead: 'Kolba zostaje dokładnie jak w logo, korek wyskakuje, a z szyjki wypływa dżin z lilią na głowie.',
    cards: [
      { key: '2A', name: 'Złoty dżin', tag: 'polecam w pomyśle 2', draw: (id, w) => genie(id, w, G, C), big: 150, small: 52,
        pros: ['Złoty jak obecny OctoBuddy – świetnie widoczny na każdym pulpicie.', 'Logo zostaje nietknięte, więc marka jest widoczna od razu.'] },
      { key: '2B', name: 'Kremowy dżin z dymu', tag: 'bardziej „magiczny”', draw: (id, w) => genie(id, w, C, G), big: 150, small: 52,
        pros: ['Dżin jak z kremowego dymu, złote akcenty.', 'Super na ciemnym pulpicie, na jasnym słabiej.'] },
    ],
  },
];

let n = 0;
const card = (c) => `
      <article class="card">
        <h3><span>${c.key}</span>${c.name}</h3>
        <span class="tag">${c.tag}</span>
        <div class="stage ${c.stage || ''}">${c.draw(++n, c.big)}</div>
        <div class="desks">
          <div class="desk dark"><small>ciemny pulpit</small>${c.draw(++n, c.small)}</div>
          <div class="desk light"><small>jasny pulpit</small>${c.draw(++n, c.small)}</div>
        </div>
        <ul class="pros">${c.pros.map((p) => `<li>${p}</li>`).join('')}</ul>
      </article>`;

const LOGO = `<svg viewBox="0 0 100 100" width="72" height="72" aria-label="Logo Black Lily Labs">
      <rect x="34" y="0" width="32" height="9" rx="3" fill="${P}"/>
      <path d="${FLASK}" fill="${P}"/>${lily(50, 72, 1)}
    </svg>`;

const html = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LilyAssist – próbki postaci</title>
  <style>
    :root { --gold: ${G}; --plum: ${P}; --cream: ${C}; --line: rgba(59, 34, 48, .15); }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 24px 48px; background: var(--cream); color: var(--plum); font: 15px/1.5 "Segoe UI", system-ui, sans-serif; }
    header, section, footer { max-width: 1100px; margin: 0 auto; }
    header { display: flex; gap: 20px; align-items: center; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 28px; }
    h2 { margin: 28px 0 2px; font-size: 21px; }
    .muted { color: rgba(59, 34, 48, .72); margin: 4px 0 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
    .card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
    .card h3 { margin: 0; font-size: 18px; }
    .card h3 span { color: var(--gold); margin-right: 8px; }
    .tag { align-self: flex-start; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 99px; background: var(--gold); color: #fff; }
    .stage { height: 290px; border-radius: 10px; background: radial-gradient(circle at 50% 40%, #fdf8f1, #e9dccb); display: flex; align-items: flex-end; justify-content: center; padding-bottom: 12px; }
    .stage.plum { background: radial-gradient(circle at 50% 40%, #4d2f40, ${P}); }
    .desks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .desk { height: 120px; border-radius: 8px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px; position: relative; }
    .desk small { position: absolute; top: 5px; left: 8px; font-size: 11px; opacity: .7; }
    .desk.dark { background: #1c1c1f; color: #ddd; }
    .desk.light { background: #e9edf2; color: #333; }
    .pros { margin: 0; padding-left: 18px; font-size: 14px; }
    .char { overflow: visible; height: auto; }
    .char g { transform-box: view-box; }
    .bob { animation: bob 1.2s ease-in-out infinite; }
    .float { animation: bob 2.4s ease-in-out infinite; }
    .stepA { animation: step .6s ease-in-out infinite; }
    .stepB { animation: step .6s ease-in-out infinite .3s; }
    .wave { animation: wave 1.4s ease-in-out infinite; }
    .slosh { animation: slosh 1.6s linear infinite; }
    .twinkle { animation: twinkle 1.6s ease-in-out infinite; }
    .pop { animation: pop 2.4s ease-in-out infinite; transform-origin: 131px 131px; }
    .cheerL { animation: cheerL .8s ease-in-out infinite; }
    .cheerR { animation: cheerR .8s ease-in-out infinite; }
    .sway { animation: sway 2s ease-in-out infinite; }
    .blink { animation: blink 4s infinite; }
    @keyframes cheerL { 50% { transform: rotate(14deg); } }
    @keyframes cheerR { 50% { transform: rotate(-14deg); } }
    @keyframes sway { 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
    @keyframes blink { 0%, 95%, 100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }
    @keyframes bob { 50% { transform: translateY(-3px); } }
    @keyframes step { 50% { transform: translateY(-3px); } }
    @keyframes wave { 50% { transform: rotate(-18deg); } }
    @keyframes slosh { to { transform: translateX(-40px); } }
    @keyframes twinkle { 50% { opacity: .25; } }
    @keyframes pop { 50% { transform: translateY(-5px) rotate(8deg); } }
    @media (prefers-reduced-motion: reduce) { .char * { animation: none !important; } }
    footer { margin-top: 28px; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    ${LOGO}
    <div>
      <h1>LilyAssist – próbki postaci (v2)</h1>
      <p class="muted">Wektorowo, w kolorach marki. Duży podgląd + prawdziwy rozmiar na ciemnym i jasnym pulpicie.</p>
    </div>
  </header>
${IDEAS.map((idea) => `  <section>
    <h2>${idea.title}</h2>
    <p class="muted">${idea.lead}</p>
    <div class="grid">${idea.cards.map(card).join('')}
    </div>
  </section>`).join('\n')}
  <footer class="muted">
    Kolory: śliwka ${P}, złoto ${G}, krem ${C}. W aplikacji postać byłaby rysowana wektorowo (gładko), a nie z dużych pikseli.
  </footer>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'lilyassist-probki.html'), html);
console.log('Gotowe: design/lilyassist-probki.html');
