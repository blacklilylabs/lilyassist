// Sprawdzanie niezapisanych zmian w repozytorium git (do przypominajki o commicie)
// i otwieranie terminala w folderze projektu.
const { execFile, spawn } = require('child_process');
const { shell } = require('electron');

// Ile plików ma niezapisane zmiany (0 = wszystko zacommitowane).
// Błąd = brak gita albo folder nie jest repozytorium.
function changedFiles(folder) {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', folder, 'status', '--porcelain'], { timeout: 10000, windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.split('\n').filter((line) => line.trim()).length);
    });
  });
}

// Windows Terminal w folderze projektu; gdy go nie ma – zwykły Eksplorator.
function openTerminal(folder) {
  try {
    const child = spawn('wt.exe', ['-d', folder], { detached: true, stdio: 'ignore' });
    child.on('error', () => shell.openPath(folder));
    child.unref();
  } catch {
    shell.openPath(folder);
  }
}

module.exports = { changedFiles, openTerminal };
