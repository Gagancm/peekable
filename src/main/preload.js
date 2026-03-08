const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('peekable', {
  checkScreenPermission: () => ipcRenderer.invoke('check-screen-permission'),
  openScreenPermissionSettings: () => ipcRenderer.invoke('open-screen-permission-settings'),
  verifyPassword: (password) => ipcRenderer.invoke('verify-password', password),
  saveOnboarding: (config) => ipcRenderer.invoke('save-onboarding', config),
  saveSettings: (config) => ipcRenderer.invoke('save-settings', config),
  getConfig: () => ipcRenderer.invoke('get-config'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  onShowPasswordPrompt: (callback) => ipcRenderer.on('show-password-prompt', callback),
  __testCompleteOnboarding: (data) => ipcRenderer.invoke('test-complete-onboarding', data)
});
