const keytar = require('keytar');
const Logger = require('../utils/logger');
const Helpers = require('../utils/helper');

class TokenManager {
    constructor(serviceName = 'TechCorp-Electron-App', accountName = 'techcorp-user') {
        this.serviceName = serviceName;
        this.accountName = accountName;
        this.refreshInterval = null;
        this.isRefreshing = false;
        this.refreshRetryCount = 0;
        this.maxRefreshRetries = 3;
        this.openidClient = null;
        this.tokenSet = null;
        this.onTokenRefresh = null;
        this.onAuthExpired = null;
    }

    setOpenIdClient(client) {
        this.openidClient = client;
    }

    setCallbacks({ onTokenRefresh, onAuthExpired }) {
        this.onTokenRefresh = onTokenRefresh;
        this.onAuthExpired = onAuthExpired;
    }

    async storeTokens(tokenSet) {
        try {
            if (tokenSet.refresh_token) {
                await keytar.setPassword(this.serviceName, this.accountName, tokenSet.refresh_token);
                Logger.debug('Refresh token stored securely in system keychain');
            }
            
            this.tokenSet = tokenSet;
            this.scheduleTokenRefresh();
            
            Logger.success('Tokens stored and refresh scheduled');
            
        } catch (error) {
            Logger.error('Failed to store tokens:', error);
            throw error;
        }
    }

    async loadStoredTokens() {
        try {
            const refreshToken = await keytar.getPassword(this.serviceName, this.accountName);
            if (refreshToken) {
                Logger.info('Stored refresh token found');
                return refreshToken;
            }
            Logger.debug('No stored tokens found');
            return null;
        } catch (error) {
            Logger.error('Failed to load stored tokens:', error);
            return null;
        }
    }

    async clearStoredTokens() {
        try {
            await keytar.deletePassword(this.serviceName, this.accountName);
            this.tokenSet = null;
            this.clearRefreshSchedule();
            this.refreshRetryCount = 0;
            Logger.info('Stored tokens cleared from system keychain');
        } catch (error) {
            Logger.error('Failed to clear stored tokens:', error);
            throw error;
        }
    }

    async refreshTokens(refreshToken = null) {
        if (this.isRefreshing) {
            Logger.debug('Refresh already in progress, skipping...');
            return false;
        }

        this.isRefreshing = true;
        const tokenToUse = refreshToken || (this.tokenSet ? this.tokenSet.refresh_token : null);

        if (!tokenToUse) {
            Logger.warn('No refresh token available for refresh');
            this.isRefreshing = false;
            return false;
        }

        try {
            Logger.info('Refreshing authentication tokens...');
            const newTokenSet = await this.openidClient.refresh(tokenToUse);
            
            await this.storeTokens(newTokenSet);
            this.refreshRetryCount = 0;

            Logger.success('Tokens refreshed successfully');
            
            if (this.onTokenRefresh) {
                this.onTokenRefresh(newTokenSet);
            }
            
            this.isRefreshing = false;
            return true;
            
        } catch (error) {
            Logger.error('Token refresh failed:', error.message);
            this.refreshRetryCount++;
            
            if (this.refreshRetryCount >= this.maxRefreshRetries) {
                Logger.error('Maximum refresh retries exceeded, clearing tokens');
                await this.clearStoredTokens();
                
                if (this.onAuthExpired) {
                    this.onAuthExpired('Session expired due to repeated refresh failures');
                }
            } else {
                const backoffDelay = 30000 * this.refreshRetryCount;
                Logger.warn(`Refresh retry ${this.refreshRetryCount}/${this.maxRefreshRetries} in ${backoffDelay/1000} seconds`);
                
                await Helpers.delay(backoffDelay);
                return await this.refreshTokens(tokenToUse);
            }
            
            this.isRefreshing = false;
            return false;
        }
    }

    scheduleTokenRefresh() {
        if (!this.tokenSet || !this.tokenSet.expires_at) {
            Logger.warn('Cannot schedule refresh: No valid token set');
            return;
        }

        this.clearRefreshSchedule();

        const refreshTime = Helpers.calculateRefreshTime(this.tokenSet.expires_at);
        
        Logger.debug(`Scheduling token refresh in ${Math.round(refreshTime / 1000)} seconds`);
        
        this.refreshInterval = setTimeout(async () => {
            Logger.debug('Scheduled token refresh triggered');
            await this.refreshTokens();
        }, refreshTime);
    }

    clearRefreshSchedule() {
        if (this.refreshInterval) {
            clearTimeout(this.refreshInterval);
            this.refreshInterval = null;
            Logger.debug('Token refresh schedule cleared');
        }
    }

    isTokenValid() {
        if (!this.tokenSet || !this.tokenSet.expires_at) {
            return false;
        }
        
        const expiresAt = this.tokenSet.expires_at * 1000;
        const now = Date.now();
        const bufferTime = 60000; // 1 minute buffer
        
        return now < (expiresAt - bufferTime);
    }

    getAccessToken() {
        return this.tokenSet?.access_token;
    }

    getTokenSet() {
        return this.tokenSet;
    }

    async getTokenStatus() {
        if (!this.tokenSet) {
            return { 
                hasTokens: false, 
                isValid: false, 
                message: 'No tokens available',
                canRefresh: false
            };
        }
        
        const isValid = this.isTokenValid();
        const expiresAt = this.tokenSet.expires_at ? new Date(this.tokenSet.expires_at * 1000) : null;
        const canRefresh = !!this.tokenSet.refresh_token;
        
        return {
            hasTokens: true,
            isValid: isValid,
            expiresAt: expiresAt,
            refreshTokenAvailable: canRefresh,
            canRefresh: canRefresh,
            message: isValid ? 'Tokens are valid' : 'Tokens have expired',
            retryCount: this.refreshRetryCount
        };
    }

    async manualRefresh() {
        Logger.info('Manual token refresh requested');
        return await this.refreshTokens();
    }

    destroy() {
        this.clearRefreshSchedule();
        this.tokenSet = null;
        Logger.info('Token manager destroyed');
    }
}

module.exports = TokenManager;