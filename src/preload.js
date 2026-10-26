// Bezpieczny „most” między oknem z ludzikiem a procesem głównym.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('octo', {
  setHover: (over) => ipcRenderer.send('pet:hover', over),
  openClaude: () => ipcRenderer.send('pet:open-claude'),
  openLink: (url) => ipcRenderer.send('pet:open-link', url),
  alertDone: () => ipcRenderer.send('pet:alert-done'),
  wantTalk: () => ipcRenderer.send('pet:want-talk'),
  tugMouse: (dx, dy) => ipcRenderer.send('pet:tug', dx, dy),
  lassoDone: () => ipcRenderer.send('pet:lasso-done'),
  reminderDone: (kind, action) => ipcRenderer.send('pet:reminder-done', kind, action),
  onReminder: (cb) => ipcRenderer.on('pet:reminder', (_e, r) => cb(r)),
  onSound: (cb) => ipcRenderer.on('pet:sound', (_e, kind) => cb(kind)),
  onReminderClear: (cb) => ipcRenderer.on('pet:reminder-clear', () => cb()),
  onLassoAwake: (cb) => ipcRenderer.on('pet:lasso-awake', () => cb()),
  onBreak: (cb) => ipcRenderer.on('pet:break', (_e, on) => cb(on)),
  onFocus: (cb) => ipcRenderer.on('pet:focus', (_e, on) => cb(on)),
  onCloak: (cb) => ipcRenderer.on('pet:cloak', () => cb()),
  onUncloak: (cb) => ipcRenderer.on('pet:uncloak', () => cb()),
  introDone: () => ipcRenderer.send('pet:intro-done'),
  onIntro: (cb) => ipcRenderer.on('pet:intro', () => cb()),
  quickMenu: () => ipcRenderer.send('pet:quick-menu'),
  onSay: (cb) => ipcRenderer.on('pet:say', (_e, msg) => cb(msg)),
  onAlert: (cb) => ipcRenderer.on('pet:alert', (_e, alert) => cb(alert)),
  onAlertClear: (cb) => ipcRenderer.on('pet:alert-clear', () => cb()),
  onCursor: (cb) => ipcRenderer.on('pet:cursor', (_e, pos) => cb(pos)),
  onLang: (cb) => ipcRenderer.on('pet:lang', (_e, code) => cb(code)),
});
