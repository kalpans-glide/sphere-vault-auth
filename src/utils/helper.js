class Helpers {
    static parseJwt(token) {
        try {
            return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        } catch (error) {
            throw new Error('Invalid JWT token');
        }
    }

    static calculateRefreshTime(expiresAt, bufferMinutes = 5) {
        const expiresInMs = expiresAt * 1000 - Date.now();
        const bufferMs = bufferMinutes * 60 * 1000;
        return Math.max(expiresInMs - bufferMs, 30000); // Minimum 30 seconds
    }

    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static generateRandomString(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

module.exports = Helpers;