const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // sometimes required to load local media iframes
    },
  });

  // Remove the default developer menu for a clean UI
  win.setMenuBarVisibility(false);

  // Pipe frontend console logs to the Node terminal for debugging
  win.webContents.on('console-message', (event, details) => {
    // details contains: level (string), message, lineNumber, sourceId
    const logPrefix = `[Frontend ${details.level ? details.level.toUpperCase() : 'INFO'}]`;
    
    // Only print the filename instead of the full giant file path
    const file = details.sourceId ? details.sourceId.split('/').pop() : 'unknown';
    
    if (details.level === 'error' || details.level === 'warning') {
      console.error(`${logPrefix} ${details.message} (${file}:${details.lineNumber})`);
    } else {
      console.log(`${logPrefix} ${details.message}`);
    }
  });

  // Load the compiled single-file index.html
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = Object.assign({}, details.responseHeaders);
    Object.keys(responseHeaders).forEach((key) => {
      if (key.toLowerCase() === 'x-frame-options' || key.toLowerCase() === 'content-security-policy') {
        delete responseHeaders[key];
      }
    });
    callback({ cancel: false, responseHeaders });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
