// Tworzy ikony z rysunku ludzika (src/sprite.js): build/icon.ico i build/icon.png (aplikacja, instalator)
// oraz src/assets/tray-16.png i tray-32.png (zasobnik). Rysunek jest wektorowy, więc renderuje go
// ukryte okno Electrona. Uruchamia się samo przed budowaniem instalatora (npm.cmd run dist).
// Ręcznie: npm.cmd run icon
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const Sprite = require('../src/sprite');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const ASSETS = path.join(ROOT, 'src', 'assets');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

// Małe ikony: sama kolba z buzią (rączki i nóżki byłyby nieczytelne). Duże: cały ludzik z rączkami w górze.
function svg(size) {
  const small = size <= 32;
  const art = small ? Sprite.draw({ legs: 'sit', arms: null }) : Sprite.draw({ arms: 'up' });
  const box = small ? '1.1 0.3 9.8 10.4' : '-0.3 -0.2 12.6 12.6';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${box}">${art}</svg>`;
}

async function render(win, size) {
  const html = `<!doctype html><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style>${svg(size)}`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((r) => setTimeout(r, 300)); // chwila na narysowanie strony
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  return img.resize({ width: size, height: size, quality: 'best' }).toPNG();
}

// Plik ICO z obrazkami PNG w środku (obsługiwane od Windows Vista).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // typ: ikona
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // 0 = 256 px
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4); // płaszczyzny
    e.writeUInt16LE(32, 6); // bity na piksel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

app.disableHardwareAcceleration();
setTimeout(() => { console.error('Nie udało się zrobić ikon (przekroczony czas).'); app.exit(1); }, 30000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true, javascript: false },
  });
  const images = [];
  for (const size of SIZES) images.push({ size, data: await render(win, size) });
  fs.mkdirSync(BUILD, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), ico(images));
  fs.writeFileSync(path.join(BUILD, 'icon.png'), images[images.length - 1].data);
  fs.writeFileSync(path.join(ASSETS, 'tray-16.png'), images.find((i) => i.size === 16).data);
  fs.writeFileSync(path.join(ASSETS, 'tray-32.png'), images.find((i) => i.size === 32).data);
  console.log('Ikony gotowe: build/icon.ico, build/icon.png, src/assets/tray-16.png, src/assets/tray-32.png');
  app.quit();
});
