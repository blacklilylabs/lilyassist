// Ikona do zasobnika: kolba z buzią, gotowe obrazki z src/assets (robi je scripts/make-icon.js).
const { nativeImage } = require('electron');
const path = require('path');

function createTrayIcon() {
  const img = nativeImage.createEmpty();
  const add = (scaleFactor, file) => {
    const png = nativeImage.createFromPath(path.join(__dirname, 'assets', file));
    const { width, height } = png.getSize();
    img.addRepresentation({ scaleFactor, width, height, buffer: png.toPNG() });
  };
  add(1, 'tray-16.png');
  add(2, 'tray-32.png');
  return img;
}

module.exports = { createTrayIcon };
