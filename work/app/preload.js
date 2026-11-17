const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('player', {
  getState: () => ipcRenderer.invoke('player:get-state'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('player:always-on-top', enabled),
  command: (source, action, value) => ipcRenderer.invoke('player:command', source, action, value)
});
