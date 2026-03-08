const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { createTray } = require('./tray');
const { store, setPassword, verifyPassword } = require('./store');
const { startMonitoring, stopMonitoring, restartMonitoring } = require('./monitor');
const { testScreenshotPermission } = require('./screenshot');

const isTest = process.env.NODE_ENV === 'test';
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 750,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Prevent window close — just hide it (disabled in test mode)
  if (!isTest) {
    mainWindow.on('close', (e) => {
      if (!app.isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });
  }
}

function showSettings() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    // If onboarding is complete, show password prompt
    if (store.get('onboardingComplete')) {
      mainWindow.webContents.send('show-password-prompt');
    }
  }
}

app.on('ready', () => {
  createWindow();
  if (!isTest) {
    createTray(showSettings);
  }

  // Prevent Cmd+Q from quitting (disabled in test mode)
  if (!isTest) {
    app.on('before-quit', (e) => {
      if (!app.isQuitting) {
        e.preventDefault();
      }
    });
  }

  // Start monitoring if onboarding already complete
  if (store.get('onboardingComplete')) {
    if (!isTest) {
      startMonitoring();
      mainWindow.hide();
    }
    // Show password prompt when they reopen
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('show-password-prompt');
    });
  }
});

// Keep app running when all windows closed (allow quit in test mode)
app.on('window-all-closed', () => {
  if (isTest) {
    app.quit();
  }
  // In production, don't quit
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

// Auto-launch on login (skip in test mode)
if (!isTest) {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true
  });
}

// ---- IPC Handlers ----

ipcMain.handle('check-screen-permission', async () => {
  return await testScreenshotPermission();
});

ipcMain.handle('open-screen-permission-settings', async () => {
  // Trigger a screenshot attempt to make macOS register the app
  await testScreenshotPermission();
  // Open System Settings to Screen Recording
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
});

ipcMain.handle('verify-password', (event, password) => {
  return verifyPassword(password);
});

ipcMain.handle('save-onboarding', (event, config) => {
  setPassword(config.password);
  store.set('parentEmail', config.email);
  store.set('categories', config.categories);
  store.set('screenshotIntervalSeconds', config.screenshotIntervalSeconds);
  store.set('alertCooldownMinutes', config.alertCooldownMinutes);
  store.set('confidenceThreshold', config.confidenceThreshold);
  store.set('onboardingComplete', true);
  if (!isTest) {
    startMonitoring();
  }
  return true;
});

ipcMain.handle('save-settings', (event, config) => {
  if (config.email) store.set('parentEmail', config.email);
  if (config.categories) store.set('categories', config.categories);
  if (config.screenshotIntervalSeconds) store.set('screenshotIntervalSeconds', config.screenshotIntervalSeconds);
  if (config.alertCooldownMinutes) store.set('alertCooldownMinutes', config.alertCooldownMinutes);
  if (config.confidenceThreshold) store.set('confidenceThreshold', config.confidenceThreshold);
  if (config.newPassword) setPassword(config.newPassword);
  if (!isTest) {
    restartMonitoring();
  }
  return true;
});

ipcMain.handle('get-config', () => {
  return {
    parentEmail: store.get('parentEmail'),
    categories: store.get('categories'),
    screenshotIntervalSeconds: store.get('screenshotIntervalSeconds'),
    alertCooldownMinutes: store.get('alertCooldownMinutes'),
    confidenceThreshold: store.get('confidenceThreshold'),
    onboardingComplete: store.get('onboardingComplete')
  };
});

// Test-only: force set onboarding complete
if (isTest) {
  ipcMain.handle('test-complete-onboarding', (event, { password, email }) => {
    setPassword(password);
    store.set('parentEmail', email);
    store.set('onboardingComplete', true);
    return true;
  });
}

ipcMain.handle('restart-app', () => {
  app.isQuitting = true;
  app.relaunch();
  app.quit();
});
