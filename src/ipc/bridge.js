const { ipcMain } = require('electron');
const { AuthAPI } = require('../auth/index');
// Expose the Auth methods
// function exposeAuth() {
//     contextBridge.exposeInMainWorld('auth', {
//         login: () => ipcRenderer.invoke('auth:login'),
//         logout: () => ipcRenderer.invoke('auth:logout'),
//         getAccessToken: () => ipcRenderer.invoke('auth:getAccessToken'),
//     });
// }

// module.exports = { exposeAuth };

// function InitAuthIPC() {
//     let auth = new AuthAPI();
//     ipcMain.handle('auth:login', auth.login());
//     ipcMain.handle('auth:logout', auth.logout());
//     ipcMain.handle('auth:getAccessToken', auth.getAccessToken());
// }

// module.exports = { InitAuthIPC };