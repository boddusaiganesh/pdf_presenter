const { app, BrowserWindow } = require('electron');
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
    // details contains: level, message, line, sourceId
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const logPrefix = `[Frontend ${levels[details.level] || 'INFO'}]`;
    
    // Only print the filename instead of the full giant file path
    const file = details.sourceId ? details.sourceId.split('/').pop() : 'unknown';
    
    if (details.level >= 2) {
      console.error(`${logPrefix} ${details.message} (${file}:${details.line})`);
    } else {
      console.log(`${logPrefix} ${details.message}`);
    }
  });

  // Load the compiled single-file index.html
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
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
