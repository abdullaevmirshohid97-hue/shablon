import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const DEV_SERVER_URL = process.env.MUBOSHER_WEB_URL ?? 'http://localhost:3000';
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'idaa finance',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    void win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: the web app is exported statically into apps/web/out
    // and copied alongside this bundle at package time.
    void win.loadFile(path.join(__dirname, 'web', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // CI/manual launch check: MUBOSHER_SMOKE_TEST=1 opens the window, proves
  // the main process booted, then exits on its own.
  if (process.env.MUBOSHER_SMOKE_TEST) {
    console.warn('[smoke-test] window created, quitting');
    setTimeout(() => app.quit(), 2000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
