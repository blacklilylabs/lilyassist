// Ludzik: chodzenie, zajęcia (laptop, wspinaczka, lasso, skoki), dymki i kliknięcia.
const FAST = new URLSearchParams(location.search).has('fast');
let M = window.OctoMessages.pl; // teksty dymków; język ustawia proces główny
const C = Sprite.COLORS;

const SCALE = 2;                   // powiększenie ludzika (1 = mały, 2 = podwójny); skaluje też skoki i prędkości
const PX = 4.5 * SCALE;            // ile pikseli ekranu ma jedna „jednostka” ludzika
const PW = Sprite.WIDTH * PX;      // szerokość ludzika (108 px)
const PH = Sprite.HEIGHT * PX;     // wysokość ludzika (108 px)
const SPEED = 32 * SCALE;          // prędkość chodzenia (px na sekundę)
const CLIMB_SPEED = 80 * SCALE;    // prędkość wspinania (px na sekundę)
const CLIMB_ZONE = 0.3;            // przy krawędzi (30% szerokości ekranu) idzie się wspinać…
const CLIMB_COOLDOWN = (FAST ? 20 : 180) * 1000; // …ale najwyżej raz na 3 minuty
const CHUTE_SPEED = 90 * SCALE;          // opadanie na spadochronie (px na sekundę)
const SKATE_SPEED = SPEED * 7;     // jazda na deskorolce

// Między zajęciami ludzik chodzi albo chwilę stoi (im większa liczba, tym częściej).
const WEIGHTS = { walk: 75, rest: 25 };
const JOG_CHANCE = 0.25; // szansa, że zwykły spacer zamieni się w trucht

// Rytm: co TALK_EVERY sekund coś mówi (gdy nie ma innego dymka), a co FUN_EVERY sekund
// robi coś śmiesznego (zajęcie z listy FUN).
const TALK_EVERY = FAST ? 5 : 20;
const FUN_EVERY = FAST ? 12 : 60;
// Zajęcia i ich wagi (im większa, tym częściej). Bieganie lubi najbardziej.
// (Picie wody jest tylko przy przypominajce o wodzie, a spanie – tylko w przerwie.)
const FUN = { laptop: 1, climb: 1, lasso: 1, music: 1, boxing: 1, run: 3, skate: 1 };

// Kolory rekwizytów – z palety Black Lily Labs (złoto, śliwka, krem).
const PROP = {
  water: '#8EC9E0',      // woda w butelce i pot (na kremowej kolbie krem byłby niewidoczny)
  glow: C.cream,         // poświata ekranu laptopa
  accent: C.plum,        // rękawice, czapka, słuchawki
  plumLight: '#6B4A5C',  // jaśniejsza śliwka: klawiatura laptopa
  shadow: '#6B4A5C',     // cień do boksu – widać go i na jasnym, i na ciemnym tle
  tongue: C.blush,       // różowy język 😛
  sheet: '#FFFDF8',      // prześcieradło duszka
};

// Laptop (osobny obrazek na ziemi): 'f' = ramka, 's' = ekran (miga), 'b' = klawiatura
const LAPTOP = [
  '.fffffff.',
  '.fsssssf.',
  '.fsssssf.',
  '.fsssssf.',
  '.fffffff.',
  'bbbbbbbbb',
];

const el = {
  pet: document.getElementById('pet'),
  sprite: document.getElementById('sprite'),
  laptop: document.getElementById('laptop'),
  rope: document.getElementById('rope'),
  notes: document.getElementById('notes'),
  zzz: document.getElementById('zzz'),
  bubble: document.getElementById('bubble'),
  bubbleText: document.getElementById('bubble-text'),
  bubbleTitle: document.getElementById('bubble-title'),
  bubbleClose: document.getElementById('bubble-close'),
  bubbleHint: document.getElementById('bubble-hint'),
};

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const W = () => window.innerWidth;
const H = () => window.innerHeight;
const groundY = () => H() - PH / 2;

// Stan ludzika. (cx, cy) = środek ludzika w oknie.
const pet = {
  cx: 0, cy: 0,
  dir: 1,          // 1 = w prawo, -1 = w lewo
  rot: 0,          // obrót w stopniach (-90 = na ścianie)
  tilt: 0,         // przechył przy gibaniu się do muzyki
  squash: 0,       // rozpłaszczenie przy drzemce (0 = normalny, 1 = placek)
  hop: 0,          // przesunięcie w pionie (skok, śmiech)
  legs: 'stand',
  arms: 'down',    // poza rąk (Sprite.POSES); 'walk'/'climb' = na zmianę z krokami, null = bez rąk
  mouth: 'grin',   // grin / smile / o / flat
  blinking: false,
  squint: false,   // zmrużone oczy (śmiech)
  jumpT: null,     // czas trwania skoku albo null
  props: null,     // rekwizyty: słuchawki, butelka, rękawice, deskorolka…
};
const cursor = { x: -9999, y: -9999 };
let quietMode = null; // 'breakRest' (twoja przerwa) / 'focus' (tryb skupienia) / null
let hovered = false;
let act = { name: 'rest', t: 0 };
let stepTimer = 0;
let jumpCooldownUntil = 0;
let climbCooldownUntil = performance.now() + 30000; // nie od razu po starcie

// ---------- Rysowanie ----------
// Ludzika rysujemy w jednostkach (viewBox 12 × 12); jedna jednostka = PX pikseli ekranu.

function pixelsSvg(rows, colorOf) {
  let out = '';
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = colorOf(ch);
      if (color) out += `<rect x="${x * PX}" y="${y * PX}" width="${PX}" height="${PX}" fill="${color}"/>`;
    });
  });
  return out;
}

// Prostokąt w jednostkach ludzika (mogą być ułamki i liczby ujemne – poza ciałem), lekko zaokrąglony.
function R(x, y, w, h, color, opacity = 1, round = 0.15) {
  const rx = Math.min(round, w / 2, h / 2);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}" fill-opacity="${opacity}"/>`;
}

// Mirror: rekwizyt „z przodu” ludzika (po stronie, w którą patrzy).
const front = (x, w, dir = pet.dir) => (dir > 0 ? x : Sprite.WIDTH - x - w);
const fx = (x, dir = pet.dir) => (dir > 0 ? x : Sprite.WIDTH - x);

const foot = (x, y, rx = 0.95, ry = 0.5) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.body}" stroke="${C.line}" stroke-width="0.22"/>`;
const line = (x1, y1, x2, y2, color = C.plum, width = 0.12) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
const drop = (x, y) => `<path d="M${x} ${y - 0.45}Q${x + 0.32} ${y} ${x} ${y + 0.3}Q${x - 0.32} ${y} ${x} ${y - 0.45}Z" fill="${PROP.water}"/>`;

// Poza rąk: przy chodzeniu i wspinaczce ręce zmieniają się razem z krokami.
function armPose() {
  if (pet.arms === 'walk') return pet.legs === 'stepB' ? 'walkB' : 'walkA';
  if (pet.arms === 'climb') return pet.legs === 'stepB' ? 'climbB' : 'climbA';
  return pet.arms;
}

// Gdzie na ekranie jest dłoń z danej pozy (do liny lassa).
function handPoint(pose) {
  const [x, y] = Sprite.POSES[pose].f;
  return { x: pet.cx - PW / 2 + fx(x) * PX, y: pet.cy - PH / 2 + pet.hop + y * PX };
}

let lastSpriteKey = '';
function drawSprite() {
  const p = pet.props || {};
  const closed = pet.blinking || pet.squint;
  const look = act.name === 'walk' || act.name === 'flee' ? pet.dir : 0; // oczy patrzą w stronę marszu
  const arms = p.cloak ? null : armPose();
  const key = `${pet.legs}|${arms}|${pet.mouth}|${closed}|${look}|${pet.dir}|${JSON.stringify(p)}`;
  if (key === lastSpriteKey) return;
  lastSpriteKey = key;

  const P = C.plum;
  let under = ''; // za ludzikiem
  let over = '';  // przed ludzikiem

  // Siedzi na ziemi (tryb skupienia): nóżki wyciągnięte do przodu po podłodze, stopa do góry.
  // Ludzik jest wtedy obniżony o 1,5 jednostki, więc ziemia jest na y = 10,5.
  if (p.groundSit) {
    under += Sprite.limb([fx(6.5), 9.9], [fx(10.4), 10], 1.05, C) + foot(fx(10.85), 9.75, 0.5, 0.85);
  }

  // Cień do walki: ciemna sylwetka naprzeciwko.
  if (p.shadow !== undefined) {
    const dx = pet.dir * (12.8 + p.shadow);
    const shadow = Sprite.draw({ dir: -pet.dir, legs: 'stand', arms: p.shadowPunch ? 'punch' : 'guard', tint: PROP.shadow });
    under += `<g transform="translate(${dx} 0)" opacity="0.55">${shadow}</g>`;
  }

  const body = Sprite.draw({
    dir: pet.dir,
    legs: pet.legs,
    arms,
    eyes: closed ? 'closed' : 'open',
    look,
    profile: p.profile,
    mouth: pet.mouth,
  });

  // Duszek (tryb „Nie przeszkadzaj”): prześcieradło przykrywa całą kolbę – zaokrąglona góra,
  // falowany dół i dwie dziury na oczy (przy mrugnięciu – kreski).
  if (p.cloak) {
    let hem = '';
    for (let x = 10.9; x > 1.2; x -= 1.1) hem += `Q${(x - 0.55).toFixed(2)} 10.8 ${Math.max(1.1, x - 1.1).toFixed(2)} 11.5`;
    over += `<path d="M1.1 11.5V5.2C1.1 1.6 3.4 -0.4 6 -0.4C8.6 -0.4 10.9 1.6 10.9 5.2V11.5${hem}Z" ` +
      `fill="${PROP.sheet}" stroke="${P}" stroke-width="0.22" stroke-linejoin="round"/>`;
    const ry = closed ? 0.12 : 0.62;
    over += `<ellipse cx="4.9" cy="4.9" rx="0.45" ry="${ry}" fill="${P}"/><ellipse cx="7.1" cy="4.9" rx="0.45" ry="${ry}" fill="${P}"/>`;
  }

  // Słuchawki: pałąk nad korkiem i nauszniki po bokach buzi (z boku widać tylko jeden).
  if (p.headphones && p.profile) {
    over += `<path d="M${fx(4.7)} 5.3C${fx(4.7)} -0.9 ${fx(7.6)} -0.9 ${fx(7.9)} 2.6" stroke="${P}" stroke-width="0.35" fill="none" stroke-linecap="round"/>`;
    over += R(front(4.15, 1.1), 5, 1.1, 1.7, P, 1, 0.45) + R(front(4.4, 0.6), 5.3, 0.6, 1.1, C.gold, 1, 0.3);
  } else if (p.headphones) {
    over += `<path d="M3.75 5.3C3.75 -1.2 8.25 -1.2 8.25 5.3" stroke="${P}" stroke-width="0.35" fill="none"/>`;
    over += R(3.2, 5, 1.1, 1.8, P, 1, 0.45) + R(7.7, 5, 1.1, 1.8, P, 1, 0.45);
    over += R(3.45, 5.35, 0.6, 1.1, C.gold, 1, 0.3) + R(7.95, 5.35, 0.6, 1.1, C.gold, 1, 0.3);
  }

  // Opaska karate (złota, ze śliwkową kropką) z końcówkami powiewającymi z tyłu.
  if (p.headband) {
    over += R(4.55, 4.1, 2.9, 0.55, C.gold, 1, 0.2) + `<circle cx="6" cy="4.375" r="0.22" fill="${P}"/>`;
    const flap = p.flap ? 0.35 : 0;
    over += R(front(3.2, 1.5), 4 + flap, 1.5, 0.4, C.gold) + R(front(3, 1.5), 4.5 - flap, 1.5, 0.4, C.gold);
  }

  // Rękawice bokserskie na dłoniach.
  if (p.gloves && arms) {
    const pose = Sprite.POSES[arms];
    [pose.f, pose.b].forEach(([x, y]) => {
      over += `<circle cx="${fx(x)}" cy="${y}" r="0.85" fill="${PROP.accent}"/><circle cx="${fx(x) - 0.25}" cy="${y - 0.25}" r="0.22" fill="${C.cream}" opacity="0.6"/>`;
    });
  }

  // Krople potu po bieganiu (spływają w rytm oddechu).
  if (p.sweat !== undefined) {
    const s = p.sweat;
    over += drop(fx(9.9), 2.6 + s * 0.6) + drop(fx(10.9), 4 + s * 0.5) + drop(fx(1.6), 3.6 + s * 0.6);
  }

  // Butelka z wodą: w dłoni albo przy buzi (pije).
  if (p.bottle === 'down') {
    over += R(front(10, 0.8), 8.75, 0.8, 1.9, PROP.water, 1, 0.25) + R(front(10.1, 0.6), 8.45, 0.6, 0.35, P, 1, 0.1);
  } else if (p.bottle === 'up') {
    over += R(front(6.6, 2.4), 6.65, 2.4, 0.85, PROP.water, 1, 0.3) + R(front(6.25, 0.4), 6.8, 0.4, 0.55, P, 1, 0.1);
  }

  // Laptop z boku na kolanach (tryb skupienia): klawiatura, uchylony ekran świecący w stronę
  // ludzika i ręka, która stuka w klawisze (wciśnięty klawisz miga na złoto).
  if (p.laptopSide) {
    over += R(front(7.9, 3.8), 9.05, 3.8, 0.45, P, 1, 0.1);
    over += R(front(11.3, 0.45), 5.7, 0.45, 3.8, P);
    over += R(front(10.75, 0.55), 6.1, 0.55, 3, PROP.glow, 0.9);
    if (p.typing) over += R(front(p.key, 0.5), 8.85, 0.5, 0.22, C.gold);
  }

  // Język wystawiony z wysiłku (skupienie).
  if (p.tongue) over += R(front(7.55, 0.5), 7.05, 0.5, 0.42, PROP.tongue, 1, 0.2);

  // Spadochron: czasza w złoto-kremowe pasy nad korkiem i linki do rąk.
  if (p.chute) {
    const dome = 'M-0.8 -2.6C-0.8 -7.6 12.8 -7.6 12.8 -2.6Z';
    over += line(-0.6, -2.6, 1.6, 5.3) + line(3.2, -2.6, 4.6, 0.8) + line(8.8, -2.6, 7.4, 0.8) + line(12.6, -2.6, 10.4, 5.3);
    let stripes = '';
    for (let x = 0.6; x < 12.8; x += 2.8) stripes += R(x, -7, 1.4, 4.4, C.cream, 1, 0);
    over += `<clipPath id="dome"><path d="${dome}"/></clipPath><path d="${dome}" fill="${C.gold}"/>` +
      `<g clip-path="url(#dome)">${stripes}</g><path d="${dome}" fill="none" stroke="${P}" stroke-width="0.15"/>`;
  }

  // Śliwkowa czapka z kremowym napisem NY na korku, daszkiem do tyłu (do jazdy na desce).
  if (p.cap) {
    over += `<path d="M4 1.6V0.6C4 -0.7 8 -0.7 8 0.6V1.6Z" fill="${PROP.accent}"/>`;
    over += R(front(2, 2.4), 1.15, 2.4, 0.45, PROP.accent, 1, 0.2);
    over += `<text x="6" y="1.25" text-anchor="middle" font-size="1" font-weight="900" ` +
      `font-family="Arial, sans-serif" fill="${C.cream}">NY</text>`;
  }

  // Deskorolka pod nogami. Przy kickflipie deska obraca się wokół długiej osi:
  // robi się cieńsza, pokazuje spód i wraca na wierzch.
  if (p.board) {
    const k = p.board.flip == null ? 1 : Math.cos(p.board.flip);
    const thick = Math.max(0.15, Math.abs(k)) * 0.7;
    over += R(-0.6, 12.05, 13.2, thick, k >= 0 ? P : C.gold, 1, 0.3); // śliwkowy wierzch, złoty spód
    if (k > 0.5) {
      over += `<circle cx="1.4" cy="12.95" r="0.45" fill="${C.cream}" stroke="${P}" stroke-width="0.15"/>` +
        `<circle cx="10.6" cy="12.95" r="0.45" fill="${C.cream}" stroke="${P}" stroke-width="0.15"/>`;
    }
  }

  el.sprite.setAttribute('viewBox', `0 0 ${Sprite.WIDTH} ${Sprite.HEIGHT}`);
  el.sprite.innerHTML = under + body + over;
}

function drawLaptop() {
  const screen = [C.cream, C.cream, C.cream, C.gold, PROP.plumLight];
  const rows = LAPTOP;
  el.laptop.style.width = `${rows[0].length * PX}px`;
  el.laptop.style.height = `${rows.length * PX}px`;
  el.laptop.setAttribute('viewBox', `0 0 ${rows[0].length * PX} ${rows.length * PX}`);
  el.laptop.innerHTML = pixelsSvg(rows, (ch) =>
    ch === 'f' ? C.plum : ch === 'b' ? PROP.plumLight : ch === 's' ? pick(screen) : null
  );
}

// Prostokąt, który ludzik zajmuje na ekranie (uwzględnia obrót).
function petRect() {
  const w = pet.rot ? PH : PW;
  const h = pet.rot ? PW : PH;
  return { x: pet.cx - w / 2, y: pet.cy - h / 2 + pet.hop, w, h };
}

function render() {
  drawSprite();
  // Rozpłaszczenie (pompki): szerszy i niższy. Skalujemy od środka, więc przesuwamy
  // ludzika w dół tak, żeby dalej dotykał ziemi.
  const sx = 1 + 0.25 * pet.squash;
  const sy = 1 - 0.35 * pet.squash;
  const ground = (PH / 2) * (1 - sy);
  el.pet.style.transform =
    `translate(${pet.cx - PW / 2}px, ${pet.cy - PH / 2 + pet.hop + ground}px) ` +
    `rotate(${pet.rot + pet.tilt}deg) scale(${sx}, ${sy})`;

  const r = petRect();

  if (el.zzz.classList.contains('on')) {
    el.zzz.style.transform = `translate(${pet.cx + (pet.dir > 0 ? 10 : -34) * SCALE}px, ${r.y - 8 * SCALE}px)`;
  }

  if (el.notes.classList.contains('on')) {
    el.notes.style.transform = `translate(${pet.cx + (pet.dir > 0 ? 14 : -40) * SCALE}px, ${r.y - 22 * SCALE}px)`;
  }

  if (el.laptop.classList.contains('on')) {
    const lw = el.laptop.clientWidth;
    const lh = el.laptop.clientHeight;
    const x = pet.dir > 0 ? pet.cx + PW / 2 - 6 * SCALE : pet.cx - PW / 2 + 6 * SCALE - lw;
    el.laptop.style.transform = `translate(${x}px, ${H() - lh}px)`;
  }


  if (el.bubble.classList.contains('on')) {
    const bw = el.bubble.offsetWidth;
    const bh = el.bubble.offsetHeight;
    const left = clamp(pet.cx - bw / 2, 6, W() - bw - 6);
    // Wyżej, gdy nad korkiem jest pętla lasa, spadochron, czapka albo słuchawki.
    const p = pet.props || {};
    const lift = act.name === 'lasso' && act.phase === 'spin' ? 22
      : p.chute ? 7 * PX : p.cap || p.headphones ? PX : 0;
    let top = r.y - bh - 12 - lift;
    const below = top < 4;
    if (below) top = r.y + r.h + 12;
    el.bubble.classList.toggle('below', below);
    el.bubble.style.setProperty('--tail', `${clamp(pet.cx - left, 14, bw - 14)}px`);
    el.bubble.style.transform = `translate(${left}px, ${top}px)`;
  }
}

// ---------- Lasso ----------

function clearRope() {
  el.rope.innerHTML = '';
}

function drawRopeSpin(hand, t) {
  const ex = pet.cx + pet.dir * 8 * SCALE;
  const ey = petRect().y - 10 * SCALE;
  const a = t * 12;
  const px = ex + Math.cos(a) * 14 * SCALE;
  const py = ey + Math.sin(a) * 5 * SCALE;
  el.rope.innerHTML =
    `<ellipse cx="${ex}" cy="${ey}" rx="${14 * SCALE}" ry="${5 * SCALE}"/>` +
    `<path d="M${hand.x},${hand.y} L${px},${py}"/>`;
}

function drawRope(hand, tip) {
  const mid = lerp(hand, tip, 0.5);
  const sag = Math.min(40, dist(hand, tip) * 0.15);
  el.rope.innerHTML =
    `<path d="M${hand.x},${hand.y} Q${mid.x},${mid.y + sag} ${tip.x},${tip.y}"/>` +
    `<circle cx="${tip.x}" cy="${tip.y}" r="${9 * SCALE}"/>`;
}

// ---------- Ruch ----------

// interval = co ile sekund zmieniają się nogi (im szybciej idzie, tym krócej).
function animateLegs(dt, interval = 0.16) {
  stepTimer += dt;
  if (stepTimer > interval) {
    stepTimer = 0;
    pet.legs = pet.legs === 'stepA' ? 'stepB' : 'stepA';
  }
}

function walkStep(dt, mul = 1) {
  let speed = SPEED * mul;
  if (pet.jumpT !== null) {
    pet.jumpT += dt;
    const k = pet.jumpT / 0.6;
    if (k >= 1) {
      pet.jumpT = null;
      pet.hop = 0;
    } else {
      pet.hop = -Math.sin(Math.PI * k) * 46 * SCALE;
      speed *= 2.5;
    }
  }
  pet.cx += pet.dir * speed * dt;
  const lo = PW / 2 + 4;
  const hi = W() - PW / 2 - 4;
  if (pet.cx < lo) { pet.cx = lo; pet.dir = 1; }
  if (pet.cx > hi) { pet.cx = hi; pet.dir = -1; }
  if (pet.jumpT === null) animateLegs(dt, 0.16 / Math.min(mul, 3));
  else pet.legs = 'stand';
}

// Kursor nisko, tuż przed ludzikiem? Hop – przeskakujemy!
function maybeJumpOverCursor() {
  if (pet.jumpT !== null || performance.now() < jumpCooldownUntil) return;
  const ahead = (cursor.x - pet.cx) * pet.dir;
  if (cursor.y > H() - PH - 10 && cursor.y < H() && ahead > PW / 2 + 2 && ahead < PW / 2 + 45 * SCALE) {
    pet.jumpT = 0;
    jumpCooldownUntil = performance.now() + 2500;
    showBubble(pick(M.jump), { duration: 900, quiet: true });
  }
}

function cursorInRange() {
  const inside = cursor.x >= 0 && cursor.x < W() && cursor.y >= 0 && cursor.y < H();
  const d = dist(cursor, { x: pet.cx, y: pet.cy });
  return inside && d > 90 && d < 450;
}

function land() {
  pet.rot = 0;
  pet.hop = 0;
  pet.cy = groundY();
  pet.cx = clamp(pet.cx, PW / 2 + 4, W() - PW / 2 - 4);
}

// ---------- Zajęcia ----------

const ACTS = {
  walk: {
    start(a) {
      a.dur = rand(4, 12);
      if (Math.random() < 0.4) pet.dir *= -1;
      pet.arms = 'walk';
      // Czasem zamiast spaceru – trucht (szybciej, pochylony do przodu).
      a.mul = Math.random() < JOG_CHANCE ? 3 : 1;
      if (a.mul > 1 && Math.random() < 0.4) showBubble(pick(M.runStart), { duration: 1800, quiet: true });
    },
    update(a, dt) {
      if (hovered && pet.jumpT === null) { // stoi, żeby dało się go kliknąć – i macha do ciebie
        pet.legs = 'stand';
        pet.tilt = 0;
        pet.arms = Math.floor(a.t * 3) % 2 ? 'up' : 'down';
        return;
      }
      pet.arms = 'walk';
      pet.tilt = a.mul > 1 ? pet.dir * 8 : 0;
      walkStep(dt, a.mul);
      maybeJumpOverCursor();
      if (pet.jumpT !== null) return;
      // Doszedł blisko krawędzi (strefa 30%) i idzie w jej stronę? Wspinaczka!
      const nearEdge = pet.dir > 0 ? pet.cx > W() * (1 - CLIMB_ZONE) : pet.cx < W() * CLIMB_ZONE;
      if (nearEdge && !introActive && performance.now() > climbCooldownUntil) {
        return start('climb', { side: pet.dir });
      }
      if (a.t > a.dur) next();
    },
  },

  // Krótki postój – ale nigdy bez ruchu: rozgląda się, macha, podskakuje, przeciąga się, tupie.
  rest: {
    start(a) {
      a.dur = rand(1.5, 4);
      a.nextFidget = rand(0.3, 0.8);
      a.fidget = null;
      pet.legs = 'stand';
    },
    update(a, dt) {
      a.nextFidget -= dt;
      if (a.nextFidget <= 0) {
        a.nextFidget = rand(0.9, 1.3); // ruch trwa ok. 0,9 s, więc przerwy między nimi są krótkie
        a.fidget = pick(['look', 'wave', 'hop', 'stretch', 'tap']);
        a.ft = 0;
        if (a.fidget === 'look') pet.dir *= -1;
        if (a.fidget === 'hop') hopOnce();
      }
      if (a.fidget) {
        a.ft += dt;
        const k = a.ft;
        pet.arms = a.fidget === 'wave' ? (Math.floor(k * 4) % 2 ? 'up' : 'down')
          : a.fidget === 'stretch' ? 'up' : 'down';
        pet.squint = a.fidget === 'stretch';
        pet.mouth = a.fidget === 'stretch' ? 'o' : 'grin';
        pet.legs = a.fidget === 'tap' ? (Math.floor(k * 6) % 2 ? 'stepA' : 'stand') : 'stand';
        if (k > 0.9) { a.fidget = null; pet.arms = 'down'; pet.squint = false; pet.mouth = 'grin'; pet.legs = 'stand'; }
      }
      if (a.t > a.dur) next();
    },
    stop() {
      pet.squint = false;
    },
  },

  // Ucieka, gdy przyłapiesz go na oglądaniu.
  flee: {
    start(a) {
      a.dur = 1.6;
      pet.arms = 'up'; // panika!
      pet.mouth = 'o';
    },
    update(a, dt) {
      walkStep(dt, 3.5);
      if (a.t > a.dur) start('rest');
    },
  },

  // Wyjmuje laptopa, ogląda coś śmiesznego i się śmieje.
  laptop: {
    start(a) {
      a.dur = rand(9, 15);
      a.nextLaugh = rand(1, 2.5);
      a.laughT = 0;
      a.flicker = 0;
      pet.legs = 'stand';
      drawLaptop();
      el.laptop.classList.add('on');
    },
    update(a, dt) {
      a.flicker += dt;
      if (a.flicker > 0.3) { a.flicker = 0; drawLaptop(); }

      // Przyłapany! Kursor podjechał za blisko.
      if (a.t > 0.6 && dist(cursor, { x: pet.cx, y: pet.cy }) < 170) {
        this.stop();
        showBubble(pick(M.laptopCaught), { duration: 2500 });
        pet.dir = cursor.x > pet.cx ? -1 : 1;
        return start('flee');
      }

      a.nextLaugh -= dt;
      if (a.nextLaugh <= 0) {
        a.laughT = 1.3;
        a.nextLaugh = rand(2.5, 4.5);
        showBubble(pick(M.laptopLaugh), { duration: 1400, quiet: true });
      }
      if (a.laughT > 0) {
        a.laughT -= dt;
        pet.squint = true;
        pet.hop = Math.floor(a.t * 12) % 2 ? -2 * SCALE : 0;
      } else {
        pet.squint = false;
        pet.hop = 0;
      }

      if (a.t > a.dur) { this.stop(); next(); }
    },
    stop() {
      el.laptop.classList.remove('on');
      pet.squint = false;
      pet.hop = 0;
    },
  },

  // Wspina się po lewej albo prawej krawędzi ekranu aż na górę. Na szczycie jedno z trzech:
  // zjeżdża z „Woohoo!”, boi się wysokości i skacze z saltem („Cowabunga!”)
  // albo skacze ze spadochronem i szybuje na środek ekranu.
  climb: {
    start(a) {
      a.phase = 'toWall';
      pet.arms = 'walk';
      a.side = a.side || (pet.cx > W() / 2 ? 1 : -1); // 1 = prawa krawędź, -1 = lewa
      pet.dir = a.side;
      climbCooldownUntil = performance.now() + CLIMB_COOLDOWN;
    },
    update(a, dt) {
      const s = a.side;
      const bottom = H() - PW / 2; // środek ludzika stojącego na ścianie przy samym dole

      if (a.phase === 'toWall') {
        pet.dir = s;
        walkStep(dt, 1.8);
        pet.dir = s;
        const atWall = s > 0 ? pet.cx >= W() - PW / 2 - 5 : pet.cx <= PW / 2 + 5;
        if (atWall) {
          a.phase = 'up';
          pet.arms = 'climb';
          pet.rot = -90 * s; // nogi przy ścianie
          pet.cx = s > 0 ? W() - PH / 2 : PH / 2;
          pet.cy = bottom;
        }
      } else if (a.phase === 'up') {
        pet.cy -= CLIMB_SPEED * dt;
        animateLegs(dt, 0.1);
        if (!a.complained && pet.cy <= H() * 0.6) {
          a.complained = true;
          showBubble(pick(M.climb), { duration: 5000, quiet: true });
        }
        if (pet.cy <= H() * 0.15) {
          a.phase = 'top';
          a.topT = 0;
          pet.legs = 'stand';
          pet.arms = 'down';
          a.ending = pick(['slide', 'jump', 'chute']);
          if (a.ending === 'jump') showBubble(pick(M.climbFear), { duration: 3500 });
          if (a.ending === 'chute') showBubble(pick(M.chuteOpen), { duration: 3000 });
        }
      } else if (a.phase === 'top') {
        a.topT += dt;
        if (a.ending === 'slide' && a.topT > 1.2) {
          a.phase = 'slide';
          pet.arms = 'up';
          showBubble(pick(M.climbWoohoo), { duration: 2500 });
        } else if (a.ending === 'chute' && a.topT > 1.5) {
          // Odbija się od ściany, otwiera spadochron i celuje w środek ekranu.
          a.phase = 'chute';
          pet.arms = 'up';
          pet.rot = 0;
          pet.cx -= s * 30 * SCALE;
          pet.props = { chute: true };
          a.vx = (W() / 2 - pet.cx) / ((groundY() - pet.cy) / CHUTE_SPEED);
        } else if (a.ending === 'jump') {
          if (!a.yolo && a.topT > 3) {
            a.yolo = true;
            showBubble(pick(M.climbYolo), { duration: 1500 });
          }
          if (a.topT > 4.4) {
            a.phase = 'jump';
            pet.arms = 'up';
            pet.mouth = 'o';
            a.vx = -s * 240; // odbija się od ściany
            a.vy = -280;
            showBubble(pick(M.cowabunga), { duration: 2500 });
          }
        }
      } else if (a.phase === 'slide') {
        pet.cy += 520 * dt;
        if (pet.cy >= bottom) {
          land();
          pet.dir = -s;
          start('rest');
        }
      } else if (a.phase === 'jump') {
        a.vy += 900 * dt; // grawitacja
        pet.cx += a.vx * dt;
        pet.cy += a.vy * dt;
        pet.rot -= s * 540 * dt; // salto w locie
        if (a.vy > 0 && pet.cy >= groundY()) {
          land();
          pet.dir = -s;
          showBubble(pick(M.landed), { duration: 2000 });
          start('rest');
        }
      } else if (a.phase === 'chute') {
        pet.cx += a.vx * dt;
        pet.cy += CHUTE_SPEED * dt;
        pet.tilt = Math.sin(a.t * 1.6) * 8; // kołysze się na wietrze
        if (pet.cy >= groundY()) {
          land();
          showBubble(pick(M.chuteLanded), { duration: 3000 });
          start('rest');
        }
      }
    },
    stop() {
      pet.props = null;
      pet.tilt = 0;
      land();
    },
  },

  // Próbuje złapać kursor na lasso.
  // a.awake = tryb „budzika ekranu”: zawsze trafia i kilka razy delikatnie szarpie myszką.
  lasso: {
    start(a) {
      a.phase = 'spin';
      a.pt = 0;
      a.tugs = 0;
      pet.arms = 'lasso';
      pet.legs = 'stand';
      showBubble(pick(a.awake ? M.lassoAwake : M.lassoSpin), { duration: 1800, quiet: true });
    },
    update(a, dt) {
      a.pt += dt;
      const target = { x: clamp(cursor.x, 0, W()), y: clamp(cursor.y, 0, H()) };
      if (a.phase === 'spin') pet.dir = target.x >= pet.cx ? 1 : -1;
      const hand = handPoint('lasso');

      if (a.phase === 'spin') {
        drawRopeSpin(hand, a.t);
        if (a.pt > 1.6) { a.phase = 'throw'; a.pt = 0; }
      } else if (a.phase === 'throw') {
        const k = Math.min(1, a.pt / 0.4);
        a.tip = lerp(hand, target, 1 - (1 - k) * (1 - k));
        drawRope(hand, a.tip);
        if (k >= 1) {
          a.caught = a.awake || Math.random() < 0.5;
          a.phase = a.caught ? 'caught' : 'miss';
          a.pt = 0;
          showBubble(pick(a.caught ? (a.awake ? M.lassoTug : M.lassoCaught) : M.lassoMiss), { duration: 2200 });
        }
      } else if (a.phase === 'caught') {
        a.tip = target; // pętla trzyma kursor
        drawRope(hand, a.tip);
        // Budzik ekranu: przeciąganie liny – dwa razy do siebie, potem myszka się wyrywa
        // i wraca na swoje miejsce (w sumie kursor zostaje tam, gdzie był).
        const TUGS = [4, 4, -3, -5];
        if (a.awake && a.tugs < TUGS.length && a.pt > 0.4 + a.tugs * 0.5) {
          const towards = Math.sign(pet.cx - cursor.x) || pet.dir;
          window.octo.tugMouse(towards * TUGS[a.tugs], a.tugs % 2 ? 2 : -2);
          a.tugs += 1;
          pet.hop = -2 * SCALE; // szarpnięcie
          setTimeout(() => { if (act === a) pet.hop = 0; }, 150);
        }
        if (a.pt > 2.5) { a.phase = 'reel'; a.pt = 0; a.from = { ...a.tip }; }
      } else if (a.phase === 'miss') {
        a.tip = { x: a.tip.x, y: Math.min(H() - 9 * SCALE, a.tip.y + 600 * dt) }; // lina spada
        drawRope(hand, a.tip);
        if (a.pt > 0.8) { a.phase = 'reel'; a.pt = 0; a.from = { ...a.tip }; }
      } else if (a.phase === 'reel') {
        const k = Math.min(1, a.pt / 0.4);
        drawRope(hand, lerp(a.from, hand, k));
        if (k >= 1) start('rest');
      }
    },
    stop(a) {
      clearRope();
      if (a.awake) window.octo.lassoDone();
    },
  },

  // Słucha muzyki na słuchawkach, giba się na boki i robi „umcy umcy”.
  music: {
    start(a) {
      a.dur = rand(14, 20);
      a.nextUmcy = 5;
      pet.props = { headphones: true };
      el.notes.classList.add('on');
      showBubble(pick(M.musicStart), { duration: 3000, quiet: true });
    },
    update(a) {
      const bpm = 2.2; // uderzenia na sekundę
      const beat = Math.floor(a.t * bpm) % 2;
      pet.tilt = Math.sin(a.t * bpm * Math.PI) * 12; // gibanie na boki
      pet.hop = beat ? -3 * SCALE : 0;
      pet.legs = beat ? 'stepA' : 'stepB';
      pet.arms = beat ? 'up' : 'down'; // taniec
      pet.squint = Math.floor(a.t / 3) % 2 === 1; // oczy zamknięte, czuje bit
      if (a.t > a.nextUmcy) {
        a.nextUmcy += 5;
        showBubble(pick(M.musicSing), { duration: 2500, quiet: true });
      }
      if (a.t > a.dur) next();
    },
    stop() {
      el.notes.classList.remove('on');
      pet.props = null;
      pet.squint = false;
      pet.hop = 0;
      pet.tilt = 0;
    },
  },

  // Pije wodę „gul, gul” – tylko przy przypominajce o wodzie (pytanie zadaje sam dymek przypominajki).
  water: {
    start() {
      pet.legs = 'stand';
      pet.props = { bottle: 'down' };
      pet.arms = 'bottle';
    },
    update(a) {
      if (a.t > 0.8 && a.t < 3.3) {
        if (pet.props.bottle !== 'up') {
          pet.props = { bottle: 'up' };
          pet.arms = 'drink';
          pet.mouth = 'o';
          showBubble(pick(M.waterDrink), { duration: 2300, quiet: true });
        }
        pet.squint = true;
      } else if (a.t >= 3.3 && pet.props.bottle === 'up') {
        pet.props = { bottle: 'down' };
        pet.arms = 'bottle';
        pet.mouth = 'grin';
        pet.squint = false;
      }
      if (a.t > 8) next();
    },
    stop() {
      pet.props = null;
      pet.squint = false;
    },
  },

  // Boks z cieniem, w opasce karate.
  boxing: {
    start(a) {
      a.dur = rand(10, 14);
      a.nextShout = 4;
      pet.legs = 'stand';
      showBubble(pick(M.boxing), { duration: 2000, quiet: true });
    },
    update(a) {
      const step = Math.floor(a.t / 0.35);
      const punch = step % 2 === 0;
      pet.props = {
        headband: true,
        gloves: true,
        punch,
        flap: step % 2 === 1,
        shadow: Math.round(Math.sin(a.t * 4) * 2) / 2, // cień robi uniki
        shadowPunch: step % 4 === 3,
      };
      pet.hop = step % 2 ? -SCALE : 0;
      pet.arms = punch ? 'punch' : 'guard';
      pet.mouth = 'flat';
      if (a.t > a.nextShout) {
        a.nextShout += 4;
        showBubble(pick(M.boxing), { duration: 1800, quiet: true });
      }
      if (a.t > a.dur) next();
    },
    stop() {
      pet.props = null;
      pet.hop = 0;
    },
  },

  // Bieganie: szybki sprint, a potem zadyszka i krople potu.
  run: {
    start(a) {
      a.phase = 'sprint';
      pet.arms = 'walk';
      a.dur = rand(3, 4.5);
      pet.dir = pet.cx < W() / 2 ? 1 : -1; // biegnie tam, gdzie więcej miejsca
      showBubble(pick(M.runStart), { duration: 1800, quiet: true });
    },
    update(a, dt) {
      if (a.phase === 'sprint') {
        walkStep(dt, 6);
        pet.tilt = pet.dir * 10; // pochylony do przodu
        pet.hop = Math.floor(a.t * 10) % 2 ? -2 * SCALE : 0;
        if (a.t > a.dur) {
          a.phase = 'tired';
          pet.arms = 'down';
          pet.mouth = 'o';
          a.tiredT = 0;
          pet.legs = 'stand';
          showBubble(pick(M.runTired), { duration: 6000 });
        }
      } else {
        a.tiredT += dt;
        const breath = Math.floor(a.tiredT * 3) % 2; // ciężki oddech
        pet.hop = breath ? -SCALE : 0;
        pet.tilt = pet.dir * 6; // zgarbiony ze zmęczenia
        pet.squint = true;
        pet.props = { sweat: breath };
        if (a.tiredT > 6.5) next();
      }
    },
    stop() {
      pet.tilt = 0;
      pet.hop = 0;
      pet.squint = false;
      pet.props = null;
    },
  },

  // Deskorolka: jazda przez pół ekranu, kickflip i „Jestem de best!”.
  skate: {
    start(a) {
      a.phase = 'ride';
      a.dist = 0;
      a.goal = W() * 0.45; // ok. pół ekranu (w stronę, gdzie jest więcej miejsca)
      pet.dir = pet.cx < W() / 2 ? 1 : -1;
      pet.legs = 'stand';
      pet.props = { cap: true, board: { flip: null } };
      pet.arms = 'out';
      showBubble(pick(M.skateStart), { duration: 2000, quiet: true });
    },
    update(a, dt) {
      const BOARD_HOP = -6 * SCALE; // ludzik stoi na desce, więc jest trochę wyżej
      if (a.phase === 'ride') {
        pet.cx += pet.dir * SKATE_SPEED * dt;
        a.dist += SKATE_SPEED * dt;
        pet.hop = BOARD_HOP;
        pet.tilt = pet.dir * 4; // pochylony w stronę jazdy
        if (a.dist >= a.goal) {
          a.phase = 'kickflip';
          pet.arms = 'up';
          a.ft = 0;
          pet.tilt = 0;
        }
      } else if (a.phase === 'kickflip') {
        a.ft += dt;
        const k = Math.min(1, a.ft / 0.7);
        pet.cx += pet.dir * SKATE_SPEED * 0.6 * dt;
        pet.hop = BOARD_HOP - Math.sin(Math.PI * k) * 40 * SCALE;
        pet.props = { cap: true, board: { flip: k < 1 ? Math.round(k * 16) / 16 * Math.PI * 2 : null } };
        if (k >= 1) {
          a.phase = 'roll';
          pet.arms = 'out';
          a.rt = 0;
          showBubble(pick(M.skateBest), { duration: 3000 });
        }
      } else if (a.phase === 'roll') {
        a.rt += dt;
        pet.cx += pet.dir * SKATE_SPEED * 0.5 * Math.max(0, 1 - a.rt / 1.2) * dt; // wytraca prędkość
        pet.hop = BOARD_HOP;
        if (a.rt > 2.5) next();
      }
      pet.cx = clamp(pet.cx, PW / 2 + 4, W() - PW / 2 - 4);
    },
    stop() {
      pet.props = null;
      pet.hop = 0;
      pet.tilt = 0;
    },
  },

  // Pompki (przy przypominajce o przerwie): przysiada i rozpłaszcza się w rytm, jak przy pompkach.
  pushups: {
    start() {
      pet.legs = 'squat';
      pet.arms = 'pushup';
    },
    update(a) {
      pet.squash = 0.45 * (0.5 - 0.5 * Math.cos(a.t * Math.PI * 2 * 0.8)); // w dół i w górę
      pet.squint = Math.sin(a.t * Math.PI * 2 * 0.8) > 0.6;                // wysiłek!
      pet.mouth = pet.squint ? 'flat' : 'grin';
      if (a.t > 8) next();
    },
    stop() {
      pet.squash = 0;
      pet.squint = false;
      pet.legs = 'stand';
    },
  },

  // Alarm: trzy szybkie podskoki, żeby zwrócić uwagę na ważny alert.
  alarm: {
    start(a) {
      pet.legs = 'stand';
      pet.arms = 'up';
      pet.mouth = 'o';
    },
    update(a) {
      const k = (a.t % 0.4) / 0.4;
      pet.hop = a.t < 1.2 ? -Math.sin(Math.PI * k) * 14 * SCALE : 0;
      if (a.t > 1.2) start('rest');
    },
    stop() {
      pet.hop = 0;
    },
  },

  // Twoja przerwa: ludzik też odpoczywa – siedzi na ziemi (bez nóżek), śpi i chrapie „ZZz”,
  // aż przerwa się skończy.
  breakRest: {
    start() {
      pet.legs = 'sit';
      pet.squint = true;  // oczy zamknięte
      pet.mouth = 'o';    // pochrapuje
      el.zzz.classList.add('on');
    },
    update(a) {
      pet.hop = 1.6 * PX; // siedzi na ziemi: kolba niżej, dokładnie tam, gdzie były nóżki
      pet.squint = true;
      pet.squash = 0.03 * (1 - Math.cos(a.t * Math.PI * 0.5)); // spokojny oddech
    },
    stop() {
      el.zzz.classList.remove('on');
      pet.squint = false;
      pet.squash = 0;
      pet.legs = 'stand';
      pet.hop = 0;
    },
  },

  // Tryb skupienia: widok z boku (jedno oko) – siedzi na ziemi w słuchawkach i koduje na laptopie.
  focus: {
    start() {
      pet.legs = 'sit';
      pet.hop = 1.5 * PX; // siedzi na ziemi: niżej o 1,5 jednostki
    },
    update(a) {
      // Stuka w klawiaturę: ręka chodzi w górę i w dół, co jakiś czas krótka pauza na myślenie.
      const thinking = a.t % 7 > 5.5;
      const tap = Math.floor(a.t * 7);
      pet.hop = 1.5 * PX;
      pet.arms = !thinking && tap % 2 === 0 ? 'typeDown' : 'type';
      pet.mouth = a.t % 11 > 7.5 ? 'flat' : 'smile';
      pet.props = {
        groundSit: true,
        headphones: true,
        laptopSide: true,
        profile: true,
        typing: !thinking && tap % 2 === 0,
        key: [8.6, 9.6, 9.1, 10.3][tap % 4],         // który klawisz właśnie wciska
        tongue: a.t % 11 > 7.5,                    // co jakiś czas język na wierzchu z wysiłku
      };
    },
    stop() {
      pet.props = null;
      pet.legs = 'stand';
      pet.hop = 0;
    },
  },

  // „Nie przeszkadzaj”: narzuca białe prześcieradło, zamienia się w duszka, unosi się,
  // kołysze i powoli znika (okno chowa potem main.js).
  cloak: {
    start() {
      pet.legs = 'sit'; // nogi schowane pod prześcieradłem (duszek unosi się w powietrzu)
      pet.props = { cloak: true };
      pet.arms = null;
      showBubble(pick(M.cloakOn), { duration: 2000 });
    },
    update(a) {
      pet.hop = -Math.min(1, a.t / 1.5) * 14 * SCALE; // unosi się nad ziemię
      pet.tilt = Math.sin(a.t * 4) * 5;       // duszkowe kołysanie
      if (!a.faded && a.t > 0.9) {
        a.faded = true;
        el.pet.classList.add('vanished');
      }
      if (!a.quiet && a.t > 1.8) {
        a.quiet = true;
        if (!alertActive && !introActive) hideBubble();
      }
    },
    stop() {
      el.pet.classList.remove('vanished');
      pet.props = null;
      pet.legs = 'stand';
      pet.hop = 0;
      pet.tilt = 0;
    },
  },

  // Intro: stoi i opowiada (każdy dymek z małym podskokiem).
  intro: {
    start() {
      pet.legs = 'stand';
      pet.arms = 'up';
    },
    update() {},
  },

};

let talkTimer = 0;
let funTimer = 0;
let talkPending = false; // pora coś powiedzieć, ale na ekranie jest jeszcze inny dymek
let funPending = false; // pora na zajęcie, ale ludzik jeszcze kończy poprzednie
let lastFun = '';

// opts = dodatkowe ustawienia zajęcia, np. { side: 1 } – na którą ścianę się wspinać.
function start(name, opts = {}) {
  const prev = ACTS[act.name];
  if (prev && prev.stop) prev.stop.call(prev, act);
  pet.jumpT = null;
  if (pet.rot === 0) pet.hop = 0;
  if (FUN[name]) lastFun = name;
  act = { name, t: 0, ...opts };
  pet.arms = 'down';
  pet.mouth = 'grin';
  ACTS[name].start(act);
}

// Losowanie z wagami: { a: 1, b: 3 } → b trzy razy częściej niż a.
function pickWeighted(weights) {
  const entries = Object.entries(weights);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [name, w] of entries) {
    r -= w;
    if (r < 0) return name;
  }
  return entries[entries.length - 1][0];
}

// Co minutę: losowa animacja (inna niż ostatnio).
function startFun() {
  const options = Object.fromEntries(Object.entries(FUN)
    .filter(([n]) => n !== lastFun && (n !== 'lasso' || cursorInRange())));
  start(pickWeighted(options));
}

function next() {
  if (quietMode) return start(quietMode); // po alercie itp. wraca do przerwy / skupienia
  start(pickWeighted(WEIGHTS));
}

// ---------- Dymki ----------

let bubbleTimer = null;
let bubbleLink = null;
let bubbleImportant = false;
let alertActive = false; // ważny alert z RSS – nic go nie przykrywa
let introActive = false; // jednorazowe intro – też nic go nie przykrywa
let reminderKind = null; // przypominajka o wodzie / przerwie – czeka na klik albo ✕

// quiet = krótki okrzyk, który nie przykrywa ważniejszego dymka (np. newsa).
// alert = czerwony dymek z nagłówkiem, wisi aż go przeczytasz albo zamkniesz.
// intro / reminder = złoty dymek z nagłówkiem, klikalny, z ✕.
// Ważność: alert > intro > przypominajka > reszta.
function showBubble(text, { sticky = false, duration = 7000, link = null, hint = '', quiet = false, alert = null, intro = null, reminder = null } = {}) {
  if (alertActive && !alert) return;
  if (introActive && !intro) return;
  if (reminderKind && !reminder && !alert && !intro) return;
  if (quiet && bubbleImportant && el.bubble.classList.contains('on')) return;
  clearTimeout(bubbleTimer);
  el.bubbleTitle.textContent = alert || intro || reminder || '';
  el.bubbleText.textContent = text;
  el.bubbleHint.textContent = hint;
  bubbleLink = link;
  bubbleImportant = Boolean(link || sticky || alert || intro || reminder);
  alertActive = Boolean(alert);
  if (!reminder) reminderKind = null;
  el.bubble.classList.toggle('has-link', Boolean(link));
  el.bubble.classList.toggle('alert', Boolean(alert));
  el.bubble.classList.toggle('intro', Boolean(intro || reminder));
  el.bubble.classList.remove('on');
  void el.bubble.offsetWidth; // restart animacji
  el.bubble.classList.add('on');
  if (!sticky && !alert && !intro && !reminder) bubbleTimer = setTimeout(hideBubble, link ? 12000 : duration);
}

function hideBubble() {
  el.bubble.classList.remove('on', 'has-link', 'alert', 'intro');
  bubbleLink = null;
  bubbleImportant = false;
  alertActive = false;
  reminderKind = null;
}

// Przypominajka: klik = zrobione (wypite / przerwa), ✕ = później.
function finishReminder(action) {
  const kind = reminderKind;
  if (!kind) return;
  hideBubble();
  window.octo.reminderDone(kind, action);
}

// ---------- Intro (pierwsze uruchomienie) ----------

let introStep = 0;
let introTimer = null;

function hopOnce() {
  el.pet.classList.remove('hop');
  void el.pet.offsetWidth;
  el.pet.classList.add('hop');
}

function showIntroStep() {
  const steps = M.intro;
  const last = introStep === steps.length - 1;
  clearTimeout(introTimer);
  showBubble(steps[introStep], {
    intro: `${M.introTitle} ${introStep + 1}/${steps.length}`,
    hint: last ? M.introHintLast : M.introHint,
  });
  hopOnce();
  introTimer = setTimeout(nextIntroStep, 10000); // bez klikania też samo idzie dalej
}

function nextIntroStep() {
  introStep += 1;
  if (introStep >= M.intro.length) finishIntro();
  else showIntroStep();
}

function finishIntro() {
  if (!introActive) return;
  clearTimeout(introTimer);
  introActive = false;
  hideBubble();
  talkTimer = 0;
  funTimer = 0;
  start('walk');
  window.octo.introDone();
}

// Alert przeczytany albo zamknięty – daj znać procesowi głównemu.
function finishAlert() {
  if (!alertActive) return;
  hideBubble();
  window.octo.alertDone();
}

// ---------- Mrugnięcia ----------

function scheduleBlink() {
  setTimeout(() => {
    pet.blinking = true;
    setTimeout(() => { pet.blinking = false; }, 140);
    scheduleBlink();
  }, rand(2500, 6000));
}

// ---------- Myszka ----------

function inside(p, r, pad = 0) {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
}

// Okno przepuszcza kliknięcia wszędzie poza ludzikiem (i dymkiem z linkiem).
function updateHover() {
  let over = inside(cursor, petRect(), 3);
  if (!over && (bubbleLink || introActive || reminderKind)) {
    const b = el.bubble.getBoundingClientRect();
    over = inside(cursor, { x: b.left, y: b.top, w: b.width, h: b.height });
  }
  if (over !== hovered) {
    hovered = over;
    window.octo.setHover(over);
  }
}

function openBubbleLink() {
  if (!bubbleLink) return false;
  window.octo.openLink(bubbleLink);
  if (alertActive) finishAlert();
  else hideBubble();
  return true;
}

el.pet.addEventListener('click', () => {
  hopOnce();
  showBubble(pick(M.clicked), { duration: 2500 });
  window.octo.openClaude();
});

// Prawy klik: przy newsie, ciekawostce lub alercie otwiera artykuł,
// a bez nich – szybkie menu (Otwórz Claude i prompty), to samo co Ctrl+Alt+P.
function onRightClick(e) {
  e.preventDefault();
  if (openBubbleLink()) return;
  window.octo.quickMenu();
}
el.pet.addEventListener('contextmenu', onRightClick);
el.bubble.addEventListener('contextmenu', onRightClick);
el.bubble.addEventListener('click', (e) => {
  if (introActive) {
    if (e.target === el.bubbleClose) finishIntro(); // ✕ pomija intro
    else nextIntroStep();
  } else if (reminderKind) {
    finishReminder(e.target === el.bubbleClose ? 'later' : 'do');
  } else if (e.target === el.bubbleClose) {
    finishAlert(); // ✕ zamyka alert bez otwierania
  } else {
    openBubbleLink();
  }
});

// ---------- Wiadomości z procesu głównego ----------

window.octo.onCursor((pos) => {
  cursor.x = pos.x;
  cursor.y = pos.y;
});

window.octo.onSay(({ text, sticky, link, hint }) => showBubble(text, { sticky, link, hint }));

// Ważny alert: ludzik podskakuje i pokazuje czerwony dymek.
window.octo.onAlert(({ source, text, link }) => {
  start('alarm');
  showBubble(text, { link, hint: M.alertHint, alert: `🚨 ${M.alertTitle} · ${source}` });
});

window.octo.onIntro(() => {
  if (introActive) return;
  introActive = true;
  introStep = 0;
  start('intro');
  showIntroStep();
});

// Przerwa albo tryb skupienia: ludzik się wycisza (bez zajęć i gadania co minutę).
function setQuietMode(name, on) {
  if (on) {
    quietMode = name;
    start(name);
  } else if (quietMode === name) {
    quietMode = null;
    start('rest');
  }
}
window.octo.onBreak((on) => setQuietMode('breakRest', on));
window.octo.onFocus((on) => setQuietMode('focus', on));

// ---------- Dźwięki przypominajek ----------
// Generowane na miejscu (Web Audio), bez plików: krótkie, ciche sinusy z łagodnym wygaszeniem.
// [opóźnienie s, częstotliwość od, do (Hz), długość s, głośność]
const SOUNDS = {
  water: [[0, 1400, 600, 0.18, 0.09], [0.17, 1150, 520, 0.22, 0.06]], // „plum, plum” – dwie kropelki
  break: [[0, 784, 784, 0.8, 0.07], [0.33, 659, 659, 1.0, 0.07]],     // „ding-dong” (G5 → E5)
};
let audio = null;

function tone(t0, f0, f1, dur, vol) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.5);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function playSound(kind) {
  const notes = SOUNDS[kind];
  if (!notes) return;
  try {
    audio = audio || new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime + 0.05;
    notes.forEach(([dt, f0, f1, dur, vol]) => tone(t + dt, f0, f1, dur, vol));
  } catch (err) {
    console.warn('Dźwięk nie zagrał:', err.message);
  }
}
window.octo.onSound(playSound);

// Przypominajka: woda (ludzik pije), przerwa (pompki) albo commit (podskakuje).
// sound = jaki dźwięk zagrać (proces główny już sprawdził ustawienia i czy coś nie gra).
const REMINDER_ACT = { water: 'water', break: 'pushups', commit: 'alarm' };
window.octo.onReminder(({ kind, title, text, hint, sound }) => {
  if (introActive || alertActive) return;
  if (sound) playSound(sound);
  start(REMINDER_ACT[kind] || 'alarm', { reminder: true });
  showBubble(text, { reminder: title, hint });
  reminderKind = kind;
});

window.octo.onReminderClear(() => {
  if (reminderKind) hideBubble();
});

window.octo.onAlertClear(() => {
  if (alertActive) hideBubble();
});

// Budzik ekranu: 3 minuty bez ruchu myszki i nic nie gra – łapiemy kursor na lasso.
window.octo.onLassoAwake(() => {
  if (introActive || alertActive || reminderKind || ['cloak', 'intro'].includes(act.name)) {
    window.octo.lassoDone();
    return;
  }
  start('lasso', { awake: true });
});

// Peleryna niewidka: „Nie przeszkadzaj” włączone (cloak) albo pora się pokazać (uncloak).
window.octo.onCloak(() => {
  if (act.name !== 'cloak') start('cloak');
});
window.octo.onUncloak(() => {
  if (act.name !== 'cloak') return;
  start('rest');
  showBubble(pick(M.cloakOff), { duration: 2000, quiet: true });
});

window.octo.onLang((code) => {
  M = window.OctoMessages[code] || window.OctoMessages.pl;
  document.documentElement.lang = code;
  el.pet.title = M.petTitle;
  el.bubbleClose.title = M.close;
});

window.addEventListener('resize', () => {
  if (pet.rot === 0) pet.cy = groundY();
  pet.cx = clamp(pet.cx, PW / 2, W() - PW / 2);
});

// ---------- Pętla animacji ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  act.t += dt;
  if (!introActive && !quietMode && act.name !== 'cloak') {
    talkTimer += dt;
    funTimer += dt;
    if (talkTimer >= TALK_EVERY) { talkTimer = 0; talkPending = true; }
    if (funTimer >= FUN_EVERY) { funTimer = 0; funPending = true; }
    // Mówi, gdy nie ma innego dymka (nie przykrywa newsa ani okrzyku z zajęcia).
    if (talkPending && !el.bubble.classList.contains('on')) {
      talkPending = false;
      window.octo.wantTalk();
    }
    const free = (act.name === 'walk' || act.name === 'rest') && pet.jumpT === null;
    if (funPending && free) {
      funPending = false;
      startFun();
    }
  }
  ACTS[act.name].update(act, dt);
  updateHover();
  render();
  scheduleFrame();
}

// Jedna zaplanowana klatka naraz (żeby strażnik niżej nie zdublował pętli).
let frameRequest = 0;
function scheduleFrame() {
  if (!frameRequest) {
    frameRequest = requestAnimationFrame((now) => {
      frameRequest = 0;
      frame(now);
    });
  }
}

// Strażnik: gdyby przeglądarka wstrzymała klatki animacji (okno uznane za zasłonięte),
// sami popychamy animację, żeby ludzik nie zamarł.
setInterval(() => {
  if (performance.now() - last > 1000) {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    frame(performance.now());
  }
}, 500);

pet.cx = rand(PW, W() - PW);
pet.cy = groundY();
pet.dir = Math.random() < 0.5 ? 1 : -1;
start('walk');
scheduleBlink();
scheduleFrame();
