class Logger {
    static info(message, ...args) {
        console.log(`[SphereVault] ℹ️ ${message}`, ...args);
    }

    static error(message, ...args) {
        console.error(`[SphereVault] ❌ ${message}`, ...args);
    }

    static warn(message, ...args) {
        console.warn(`[SphereVault] ⚠️ ${message}`, ...args);
    }

    static debug(message, ...args) {
        if (process.env.DEBUG) {
            console.log(`[SphereVault] 🔍 ${message}`, ...args);
        }
    }

    static success(message, ...args) {
        console.log(`[SphereVault] ✅ ${message}`, ...args);
    }
}

module.exports = Logger;