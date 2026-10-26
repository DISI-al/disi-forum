const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('trayPick', (action) => ipcRenderer.send('tray-action', action))