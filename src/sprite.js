// Wygląd LilyAssist: kremowa kolba z logo Black Lily Labs z buzią, rączkami i nóżkami (wektorowo).
// Ten plik jest używany przez okno z ludzikiem i przez skrypt, który robi ikony (scripts/make-icon.js).
// Wszystkie współrzędne są w „jednostkach” ludzika: 12 × 12, (0, 0) = lewy górny róg.
(function (root) {
  // Kolory marki Black Lily Labs.
  const COLORS = {
    body: '#F5EBDD',  // krem – kolba
    line: '#3B2230',  // śliwka – obrys
    eye: '#C8892A',   // złote oczy
    gold: '#C8892A',
    plum: '#3B2230',
    cream: '#F5EBDD',
    blush: '#E8798F', // język
  };

  const WIDTH = 12;
  const HEIGHT = 12;

  // Kolba dokładnie jak w logo (układ 0–100); na ludzika przelicza ją transform w bodyShape().
  const FLASK = 'M41 9H59V36L88 84Q94 96 80 98H20Q6 96 12 84L41 36Z';
  const PETAL = 'M0 0C6-6 6-15 0-22C-6-15-6-6 0 0Z';
  const OUTLINE = 0.4; // o tyle obrys rączek i nóżek jest szerszy niż one same

  const HIPS = [4.75, 7.25];
  const SHOULDERS = { f: [8.6, 7.2], b: [3.4, 7.2] }; // f = ramię z przodu (w stronę patrzenia)

  // Pozycje dłoni (dla ludzika patrzącego w prawo; w lewo – odbijamy).
  const POSES = {
    down: { f: [10.3, 8.9], b: [1.7, 8.9] },
    walkA: { f: [10.6, 8.5], b: [1.9, 9.1] },
    walkB: { f: [10.0, 9.1], b: [1.4, 8.5] },
    up: { f: [10.4, 5.3], b: [1.6, 5.3] },      // „hura!”
    guard: { f: [10.6, 6.8], b: [1.5, 6.6] },   // garda do boksu
    punch: { f: [12.8, 7.0], b: [1.5, 6.6] },
    out: { f: [11.4, 7.0], b: [0.6, 7.0] },     // ręce na boki (balans na desce)
    lasso: { f: [10.4, 5.3], b: [1.7, 8.9] },
    climbA: { f: [11.3, 5.6], b: [1.7, 8.9] },
    climbB: { f: [11.0, 6.8], b: [1.7, 8.9] },
    bottle: { f: [10.4, 8.6], b: [1.7, 8.9] },
    drink: { f: [8.4, 6.4], b: [1.7, 8.9], front: true },
    pushup: { f: [10.9, 11.5], b: [1.1, 11.5] },
    type: { f: [9.6, 8.5], b: null, front: true },
    typeDown: { f: [9.7, 8.9], b: null, front: true },
  };

  const pt = (p) => `${+p[0].toFixed(3)} ${+p[1].toFixed(3)}`;

  function stroke(a, b, width, color) {
    return `<path d="M${pt(a)}L${pt(b)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
  }

  // Rączka albo nóżka: śliwkowy obrys i kremowy środek.
  function limb(a, b, width, pal) {
    return stroke(a, b, width + OUTLINE, pal.line) + stroke(a, b, width, pal.body);
  }

  const hand = (p, pal) =>
    `<circle cx="${p[0]}" cy="${p[1]}" r="0.6" fill="${pal.body}" stroke="${pal.line}" stroke-width="0.22"/>`;

  const foot = (x, y, pal) =>
    `<ellipse cx="${x}" cy="${y}" rx="0.95" ry="0.5" fill="${pal.body}" stroke="${pal.line}" stroke-width="0.22"/>`;

  // Nóżki: stand (stoi), stepA/stepB (krok – jedna stopa w górze), squat (przysiad), sit (schowane).
  function legs(kind, pal) {
    if (kind === 'sit') return '';
    if (kind === 'squat') return foot(3.2, 11.35, pal) + foot(8.8, 11.35, pal);
    const lift = [kind === 'stepA' ? 0.5 : 0, kind === 'stepB' ? 0.5 : 0];
    return HIPS.map((x, i) => {
      const y = 11.3 - lift[i];
      return limb([x, 9.7], [x, y - 0.2], 1.1, pal) + foot(x + (i ? 0.3 : -0.3), y, pal);
    }).join('');
  }

  function bodyShape(pal) {
    return `<g transform="translate(1 0.6) scale(0.1)">` +
      `<path d="${FLASK}" fill="${pal.body}" stroke="${pal.line}" stroke-width="3" stroke-linejoin="round"/>` +
      `<rect x="34" y="0" width="32" height="9" rx="3" fill="${pal.body}" stroke="${pal.line}" stroke-width="2.5"/>` +
      `<path d="M41 9.5H59" stroke="${pal.body}" stroke-width="3"/></g>`;
  }

  // Lilia z logo na brzuszku.
  function lily() {
    const petals = [0, 60, 120, 180, 240, 300]
      .map((r) => `<path transform="rotate(${r})" d="${PETAL}" fill="${COLORS.plum}"/>`).join('');
    return `<g transform="translate(6 9.1) scale(0.053)">${petals}` +
      `<circle r="5.5" fill="${COLORS.cream}"/><circle r="3.8" fill="${COLORS.gold}"/></g>`;
  }

  // Buzia: brwi, złote oczy (albo zamknięte „łuki”), usta.
  // mouth: grin (szeroki uśmiech), smile (zamknięty), o (zdziwienie / picie), flat (wysiłek).
  function face(o) {
    const P = COLORS.plum;
    const m = (x) => (o.dir > 0 ? x : WIDTH - x);
    const line = (d, w = 0.24) => `<path d="${d}" stroke="${P}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    const eye = (x, y) => {
      if (o.eyes === 'closed') return line(`M${x - 0.38} ${y}Q${x} ${y + 0.32} ${x + 0.38} ${y}`, 0.22);
      const look = (o.look || 0) * 0.12;
      return `<circle cx="${x}" cy="${y}" r="0.4" fill="${COLORS.eye}"/>` +
        `<circle cx="${x - 0.06 + look}" cy="${y + 0.05}" r="0.19" fill="${P}"/>` +
        `<circle cx="${x + 0.1}" cy="${y - 0.12}" r="0.09" fill="#fff"/>`;
    };
    let out = '';
    if (o.profile) {
      // Z boku: jedno oko i usta przesunięte w stronę patrzenia.
      const x = m(7.3);
      out += line(`M${x - 0.45} ${4.85}Q${x} ${4.55} ${x + 0.45} ${4.85}`);
      out += eye(x, 5.8);
      out += o.mouth === 'flat' ? line(`M${m(6.9)} 7.1L${m(7.7)} 7.1`, 0.22)
        : line(`M${m(6.8)} 6.9Q${m(7.3)} 7.35 ${m(7.8)} 6.9`, 0.22);
      return out;
    }
    out += line('M4.7 4.9Q5.2 4.55 5.7 4.8') + line('M6.3 4.8Q6.8 4.55 7.3 4.9');
    out += eye(5.2, 5.8) + eye(6.8, 5.9);
    if (o.mouth === 'smile') out += line('M5.3 6.75Q6 7.3 6.7 6.75', 0.24);
    else if (o.mouth === 'flat') out += line('M5.4 7.0L6.6 7.0', 0.24);
    else if (o.mouth === 'o') out += `<ellipse cx="6" cy="7.05" rx="0.42" ry="0.5" fill="${P}"/>`;
    else {
      out += `<path d="M4.7 6.55Q6 6.35 7.3 6.55Q7.2 7.7 6 7.8Q4.8 7.7 4.7 6.55Z" fill="${P}"/>`;
      out += `<path d="M5 6.6Q6 6.47 7 6.6V6.78Q6 6.65 5 6.78Z" fill="#fff"/>`;
      out += `<ellipse cx="6" cy="7.45" rx="0.6" ry="0.27" fill="${COLORS.blush}"/>`;
    }
    return out;
  }

  // Cały ludzik. o = { dir, legs, arms (nazwa z POSES albo null), eyes, look, profile, mouth, tint }.
  // tint = jeden kolor na wszystko (sylwetka cienia do boksu) – wtedy bez buzi i lilii.
  function draw(o = {}) {
    const dir = o.dir || 1;
    const pal = o.tint ? { body: o.tint, line: o.tint } : COLORS;
    const pose = o.arms ? POSES[o.arms] : null;
    const m = (p) => [dir > 0 ? p[0] : WIDTH - p[0], p[1]];
    const drop = o.legs === 'squat' ? 1.2 : 0; // w przysiadzie ciało jest niżej
    const shoulder = (s) => m([SHOULDERS[s][0], SHOULDERS[s][1] + drop]);
    const arm = (s) => (pose && pose[s] ? limb(shoulder(s), m(pose[s]), 0.75, pal) + hand(m(pose[s]), pal) : '');

    let out = legs(o.legs || 'stand', pal);
    out += arm('b');
    if (!pose || !pose.front) out += arm('f');
    let body = bodyShape(pal);
    if (!o.tint) body += lily() + face({ ...o, dir });
    out += drop ? `<g transform="translate(0 ${drop})">${body}</g>` : body;
    if (pose && pose.front) out += arm('f');
    return out;
  }

  const api = { COLORS, WIDTH, HEIGHT, POSES, draw, limb, hand };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sprite = api;
})(this);
