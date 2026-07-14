import { contextBridge } from 'electron';

// Placeholder bridge — extend with ipcRenderer-backed APIs (e.g. native
// file export, printing the ledger) as desktop-only features are added.
contextBridge.exposeInMainWorld('mubosher', {
  platform: process.platform,
});
