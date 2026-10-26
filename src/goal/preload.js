// Most między okienkiem „Cel dnia” a procesem głównym.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('goalApi', {
  get: () => ipcRenderer.invoke('goal:get'),
  save: (text) => ipcRenderer.invoke('goal:save', text),
  close: () => ipcRenderer.invoke('goal:close'),
});
