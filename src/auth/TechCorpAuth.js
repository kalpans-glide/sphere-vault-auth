const { shell } = require('electron');
const { Issuer, generators } = require('openid-client');
const express = require('express');
const dotenv = require('dotenv');
const TokenManager = require('./tokenManager');
const Logger = require('../utils/logger');
const Helpers = require('../utils/helper');

// Authentication pages
const AUTH_SUCCESS_PAGE = `
<html>
<head><title>Authentication Successful</title></head>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    <h1 style="color: green;">✅ Authentication Successful!</h1>
    <p>Welcome to TechCorp! You can close this window.</p>
    <script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>
`;

const AUTH_FAILED_PAGE = `
<html>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    <h1 style="color: red;">❌ Authentication Failed</h1>
    <p>Please try again.</p>
    <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>
`;

class TechCorpAuth {
    constructor(config = {}) {
        this.openidClient = null;
        this.code_verifier = null;
        this.localServer = null;
        this.serverPort = config.serverPort || 3000;

        // Configuration with defaults
        this.keycloakConfig = {
            issuer: config.issuer || process.env.KC_URL,
            client_id: config.clientId || process.env.CLIENT_ID,
            scope: config.scope || 'openid profile email offline_access',
            redirect_uri: config.redirectUri || `http://localhost:${this.serverPort}/callback`,
        };

        // Initialize token manager
        this.tokenManager = new TokenManager(
            config.serviceName || 'TechCorp-Electron-App',
            config.accountName || 'techcorp-user'
        );

        // Set callbacks
        this.tokenManager.setCallbacks({
            onTokenRefresh: this.handleTokenRefresh.bind(this),
            onAuthExpired: this.handleAuthExpired.bind(this)
        });

        this.onAuthSuccess = null;
        this.onAuthFailure = null;

        Logger.info('TechCorpAuth initialized with configuration', {
            issuer: this.keycloakConfig.issuer,
            client_id: this.keycloakConfig.client_id,
            redirect_uri: this.keycloakConfig.redirect_uri
        });
    }

    setCallbacks({ onAuthSuccess, onAuthFailure }) {
        this.onAuthSuccess = onAuthSuccess;
        this.onAuthFailure = onAuthFailure;
    }

    handleTokenRefresh(tokenSet) {
        Logger.debug('Token refresh completed successfully');
        // You can emit an event or call a callback here
    }

    handleAuthExpired(reason) {
        Logger.warn('Authentication expired:', reason);
        if (this.onAuthFailure) {
            this.onAuthFailure(new Error(`Authentication expired: ${reason}`));
        }
    }

    async init() {
        try {
            Logger.info('Initializing Keycloak client...');
            
            if (!this.keycloakConfig.issuer) {
                throw new Error('Keycloak issuer URL is required');
            }

            if (!this.keycloakConfig.client_id) {
                throw new Error('Keycloak client ID is required');
            }

            const keycloakIssuer = await Issuer.discover(this.keycloakConfig.issuer);
            Logger.success('Issuer discovered successfully:', keycloakIssuer.metadata.issuer);
            
            this.openidClient = new keycloakIssuer.Client({
                client_id: this.keycloakConfig.client_id,
                redirect_uris: [this.keycloakConfig.redirect_uri],
                response_types: ['code'],
                token_endpoint_auth_method: 'none',
            });

            this.tokenManager.setOpenIdClient(this.openidClient);
            
            Logger.success('Keycloak client initialized successfully');
            
            // Try to load and refresh stored tokens
            const hadStoredTokens = await this.attemptStoredTokenRefresh();
            return hadStoredTokens;
            
        } catch (error) {
            Logger.error('Failed to initialize Keycloak client:', error);
            throw error;
        }
    }

    async attemptStoredTokenRefresh() {
        try {
            const refreshToken = await this.tokenManager.loadStoredTokens();
            if (refreshToken) {
                Logger.info('Attempting to refresh stored tokens...');
                const refreshed = await this.tokenManager.refreshTokens(refreshToken);
                if (refreshed) {
                    Logger.success('Successfully refreshed stored tokens');
                    return true;
                }
            }
            return false;
        } catch (error) {
            Logger.error('Failed to refresh stored tokens:', error);
            return false;
        }
    }

    async login() {
        try {
            this.code_verifier = generators.codeVerifier();
            const code_challenge = generators.codeChallenge(this.code_verifier);

            const authUrl = this.openidClient.authorizationUrl({
                scope: this.keycloakConfig.scope,
                code_challenge,
                code_challenge_method: 'S256',
            });

            Logger.debug('Generated authentication URL');

            const app = express();

            return new Promise((resolve, reject) => {
                this.localServer = app.listen(this.serverPort, () => {
                    Logger.debug(`Authentication server listening on port ${this.serverPort}`);
                });

                app.get('/callback', async (req, res) => {
                    try {
                        Logger.debug('Received callback from Keycloak');
                        const params = this.openidClient.callbackParams(req);
                        
                        const tokenSet = await this.openidClient.callback(
                            this.keycloakConfig.redirect_uri, 
                            params, 
                            { code_verifier: this.code_verifier }
                        );

                        Logger.success('Tokens received successfully');
                        
                        // Store tokens securely
                        await this.tokenManager.storeTokens(tokenSet);
                        
                        const userInfo = await this.openidClient.userinfo(tokenSet.access_token);
                        Logger.debug('User info retrieved');
                        
                        // Enhanced user info with access control check
                        const enhancedUserInfo = await this.checkAccessControl(userInfo, tokenSet);
                        
                        res.send(AUTH_SUCCESS_PAGE);
                        
                        this.localServer.close(() => {
                            Logger.debug('Authentication server closed');
                            this.localServer = null;
                        });
                        
                        resolve(enhancedUserInfo);
                    } catch (error) {
                        Logger.error('Authentication callback error:', error);
                        res.status(400).send(AUTH_FAILED_PAGE);
                        
                        if (this.localServer) {
                            this.localServer.close();
                            this.localServer = null;
                        }
                        
                        if (this.onAuthFailure) {
                            this.onAuthFailure(error);
                        }
                        
                        reject(new Error(`Authentication failed: ${error.message}`));
                    }
                });

                // Open browser for authentication
                Logger.info('Opening browser for authentication...');
                shell.openExternal(authUrl);
            });

        } catch (error) {
            Logger.error('Login initiation error:', error);
            throw error;
        }
    }

    async checkAccessControl(userInfo, tokenSet) {
        try {
            const token = tokenSet.access_token;
            const payload = Helpers.parseJwt(token);
            
            const realmRoles = payload.realm_access?.roles || [];
            const clientRoles = payload.resource_access?.[this.keycloakConfig.client_id]?.roles || [];
            const groups = payload.groups || [];
            const department = payload.department || payload['department'] || 'Unknown';
            
            const allRoles = [...new Set([...realmRoles, ...clientRoles])];
            
            Logger.debug('Token payload analysis completed', {
                rolesCount: allRoles.length,
                groupsCount: groups.length,
                department
            });

            const accessResult = this.evaluateAccess(allRoles, groups, userInfo);
            const tokenStatus = await this.tokenManager.getTokenStatus();
            
            return {
                ...userInfo,
                department: department,
                realmRoles: realmRoles,
                clientRoles: clientRoles,
                allRoles: allRoles,
                groups: groups,
                access: accessResult,
                tokenStatus: tokenStatus,
                tokenExpiry: new Date(tokenSet.expires_at * 1000).toISOString()
            };
        } catch (error) {
            Logger.error('Error in access control check:', error);
            // Return basic user info without access control
            return {
                ...userInfo,
                department: 'Unknown',
                realmRoles: [],
                clientRoles: [],
                allRoles: [],
                groups: [],
                access: {
                    granted: true,
                    level: 'STANDARD',
                    message: `👋 Welcome ${userInfo.name || userInfo.preferred_username || 'User'}!`,
                    emoji: '🎉',
                    perks: ['Basic Access', 'Standard Features']
                },
                tokenStatus: await this.tokenManager.getTokenStatus()
            };
        }
    }

    evaluateAccess(allRoles, groups, userInfo) {
        const userName = userInfo.name || userInfo.preferred_username || 'User';
        
        // Simplified access evaluation - you can expand this based on your needs
        const hasAdmin = allRoles.some(role => role.toLowerCase().includes('admin'));
        const hasManager = allRoles.some(role => role.toLowerCase().includes('manager'));
        const isIT = groups.some(group => group && group.toLowerCase().includes('it'));
        const isHR = groups.some(group => group && group.toLowerCase().includes('hr'));
        const isFinance = groups.some(group => group && group.toLowerCase().includes('finance'));

        if (hasAdmin) {
            return {
                granted: true,
                level: 'ADMIN',
                message: `🚀 Welcome Admin ${userName}! Full system access granted!`,
                emoji: '👑',
                perks: ['All Systems', 'Admin Tools', 'Full Access']
            };
        }
        
        if (hasManager) {
            return {
                granted: true,
                level: 'MANAGER',
                message: `💼 Welcome Manager ${userName}! Management tools unlocked!`,
                emoji: '⚙️',
                perks: ['Team Management', 'Reports', 'Analytics']
            };
        }
        
        // Add more role-based access levels as needed
        
        return {
            granted: true,
            level: 'USER',
            message: `👋 Welcome ${userName}! Standard access granted.`,
            emoji: '✅',
            perks: ['Basic Access', 'Standard Features']
        };
    }

    async logout() {
        try {
            const tokenSet = this.tokenManager.getTokenSet();
            if (tokenSet?.id_token) {
                const logoutUrl = this.openidClient.endSessionUrl({
                    id_token_hint: tokenSet.id_token,
                });
                await shell.openExternal(logoutUrl);
            }
            
            await this.tokenManager.clearStoredTokens();
            Logger.success('User logged out successfully');
            return { success: true, message: "👋 Successfully logged out! See you soon!" };
            
        } catch (error) {
            Logger.error('Logout error:', error);
            // Clear tokens even if logout fails
            await this.tokenManager.clearStoredTokens();
            return { success: false, message: "Logged out locally but remote logout failed." };
        }
    }

    getAccessToken() {
        return this.tokenManager.getAccessToken();
    }

    async getTokenStatus() {
        return await this.tokenManager.getTokenStatus();
    }

    async refreshTokens() {
        return await this.tokenManager.manualRefresh();
    }

    isAuthenticated() {
        return this.tokenManager.isTokenValid();
    }

    destroy() {
        if (this.localServer) {
            this.localServer.close();
            this.localServer = null;
        }
        this.tokenManager.destroy();
        Logger.info('TechCorpAuth instance destroyed');
    }
}

module.exports = TechCorpAuth;