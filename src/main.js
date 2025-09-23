

const { InitAuthIPC } = require('./ipc/bridge');
const { AuthAPI } = require('./auth/index');

class SpherVaultAuth {

    login() {
        return ipcRenderer.invoke('auth:login');
    }
    logout() {
        return ipcRenderer.invoke('auth:logout');
    }
    getAccessToken() {
        return ipcRenderer.invoke('auth:getAccessToken');
    }
}

module.exports = { AuthAPI };