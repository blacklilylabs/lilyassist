// Most między oknem ustawień a procesem głównym.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (change) => ipcRenderer.invoke('settings:set', change),
  addFeed: (feed) => ipcRenderer.invoke('settings:add-feed', feed),
  pickFolder: () => ipcRenderer.invoke('settings:pick-folder'),
  openLink: (url) => ipcRenderer.invoke('settings:open-link', url),
  testSound: (kind) => ipcRenderer.invoke('settings:test-sound', kind),
  onChanged: (cb) => ipcRenderer.on('settings:changed', (_e, view) => cb(view)),
  onScroll: (cb) => ipcRenderer.on('settings:scroll', (_e, section) => cb(section)),
});
