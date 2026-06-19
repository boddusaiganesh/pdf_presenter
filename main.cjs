const { app, BrowserWindow, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Windows: single-instance lock ────────────────────────────────────────────
// Prevents duplicate app windows when the user double-clicks the icon again.
if (process.platform === 'win32') {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        if (wins[0].isMinimized()) wins[0].restore();
        wins[0].focus();
      }
    });
  }
}

// ── Windows: taskbar app grouping ─────────────────────────────────────────────
if (process.platform === 'win32') {
  app.setAppUserModelId('com.apexpresenter.app');
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'public', 'icon.png'),
    // Mac: hide titlebar for a cleaner look, keep traffic lights
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // webSecurity must stay true; we strip X-Frame-Options headers below
      // so embedded iframes (YouTube, Vimeo) work without disabling security.
      webSecurity: true,
      sandbox: false, // required for idb-keyval IndexedDB access in renderer
    },
    show: false, // show after ready-to-show to avoid white flash
  });

  // Show only when fully rendered — prevents white flash on startup
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Remove the default developer menu for a clean UI
  mainWindow.setMenuBarVisibility(false);

  // Pipe frontend console logs to the Node terminal for debugging
  mainWindow.webContents.on('console-message', (_event, level, message, lineNumber, sourceId) => {
    const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'info';
    const file = sourceId ? sourceId.split('/').pop() : 'unknown';
    if (level >= 2) {
      console.error(`[Renderer:${levelStr.toUpperCase()}] ${message} (${file}:${lineNumber})`);
    } else {
      console.log(`[Renderer:${levelStr}] ${message}`);
    }
  });

  // Catch renderer crashes and show a user-friendly dialog
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Renderer] Process gone:', details.reason);
    dialog.showErrorBox(
      'ApexPresenter — Unexpected Error',
      `The presentation engine crashed (${details.reason}).\nPlease restart the app. Your session is auto-saved.`
    );
  });

  // Load the compiled single-file index.html
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    // Dev fallback — load Vite dev server
    mainWindow.loadURL('http://localhost:5173');
  }

  // Mac: hide window on close instead of quitting (standard Mac behaviour)
  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  // Strip X-Frame-Options and restrictive CSP headers so embedded iframes
  // (YouTube, Vimeo, Loom, Google Drive) load correctly inside the app.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = Object.assign({}, details.responseHeaders);
    const headersToRemove = ['x-frame-options', 'content-security-policy', 'x-content-type-options'];
    Object.keys(responseHeaders).forEach((key) => {
      if (headersToRemove.includes(key.toLowerCase())) {
        delete responseHeaders[key];
      }
    });
    callback({ cancel: false, responseHeaders });
  });

  createWindow();

  // Mac: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  // On Mac, keep the app running in the dock even with no windows
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
