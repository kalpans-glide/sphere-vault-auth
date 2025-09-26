// -- dependencies --
// const { exposeAuth } = require('./ipc/bridge');
const { shell } = require('electron');
const { Issuer, generators } = require('openid-client');
const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const AUTH_SUCCESS_MESSAGE_PAGE = `
    <html>
    <head>
        <title>Authentication Successful</title>
    </head>
    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: green;">✓ Authentication Successful!</h1>
        <p>You can close this window and return to the app.</p>
        <script>
            setTimeout(() => window.close(), 3000);
        </script>
    </body>
    </html>
`;

const AUTH_FAILED_PAGE = `
    < html >
    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: red;">Authentication Failed</h1>
        <p>Please try again.</p>
        <script>
            setTimeout(() => window.close(), 3000);
        </script>
    </body>
    </html >
`;

async function kcInit(kcConfig) {
    const keycloakIssuer = await Issuer.discover(kcConfig.issuer);

    // Initialize the client
    return new keycloakIssuer.Client({
        client_id: kcConfig.client_id,
        redirect_uris: [kcConfig.redirect_uri],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
    });
}

// sphere-vault-auth
class AuthAPI {
    // -- vars --
    // for handling the open-id client, token and user info
    // and for now the keycloak configurations

    // -- Keycloak Init -- Constructor
    // init the client i.e. Issuer
    // configure the local callback server url
    constructor() {
        this.openidClient = null;
        this.tokenSet = null;
        this.code_verifier = null;
        this.localServer = null;
        this.serverPort = 3001; // later add an function to dynamically find an available port

        this.keycloakConfig = {
            issuer: process.env.KC_URL,
            client_id: process.env.CLIENT_ID,
            scope: 'openid profile email',
            redirect_uri: "http://localhost:3001/callback",
        };
    }

    async init() {
        this.openidClient = await kcInit(this.keycloakConfig);
    }


    // -- keycloak dispose -- Destructor
    // dispose the keycloak client object and info if any
    // close the callback server if active

    async login() {
        try {
            this.code_verifier = generators.codeVerifier();
            const code_challenge = generators.codeChallenge(this.code_verifier);

            const authUrl = this.openidClient.authorizationUrl({
                scope: this.keycloakConfig.scope,
                code_challenge,
                code_challenge_method: 'S256',
            });

            // Start local server
            const app = express();



            return new Promise((resolve, reject) => {
                this.localServer = app.listen(this.serverPort, () => {
                    console.log(`Local server listening on port ${this.serverPort}`);
                });

                // Handle callback
                app.get('/callback', async (req, res) => {
                    try {
                        console.log('Received callback from Keycloak');
                        const params = this.openidClient.callbackParams(req);
                        let code_verifier_a = this.code_verifier
                        console.log("Verifier" + code_verifier_a);
                        this.tokenSet = await this.openidClient.callback(this.keycloakConfig.redirect_uri, params, {
                            code_verifier: this.code_verifier
                        });

                        const userInfo = await this.openidClient.userinfo(this.tokenSet.access_token);

                        // Send success response
                        res.send(AUTH_SUCCESS_MESSAGE_PAGE);

                        // Close server
                        this.localServer.close(() => {
                            console.log('Local server closed.');
                            this.localServer = null;
                        });
                        resolve(userInfo);
                    } catch (error) {
                        // console.error('Authentication callback error:', error);
                        res.status(400).send(AUTH_FAILED_PAGE);

                        if (this.localServer) {
                            this.localServer.close();
                            this.localServer = null;
                        }
                        reject(new Error(error.message));
                    }
                });

                // Open browser after server starts
                shell.openExternal(authUrl);
            });

        } catch (error) {
            console.error('Login initiation error:', error);
            throw error;
        }

    }
    // -- login -- public method
    // pkce flow 1st part - init // get the verifier and all
    // generate the url based on this
    // start the local callback server
    /// Inside the promise
    // handler A - listen to callback server and handle the response inclusive of pkce 2nd part
    // open the browser to the keycloak login page
    // handler A - store the token if success(accesing the user info), close the callback server
    /// resolve/reject the promise when the callback is received

    async logout() {
        if (this.tokenSet?.id_token) {
            const logoutUrl = this.openidClient.endSessionUrl({
                id_token_hint: this.tokenSet.id_token,
            });
            await shell.openExternal(logoutUrl);
            this.tokenSet = null;
            this.code_verifier = null;
            return { success: true };
        }
        return { success: false, message: 'No active session.' };

    }
    // -- logout -- public method
    // if token exists - dispose the token
    // open logout page - keycloak logout
    // else - do nothing - show No Active Session
    getAccessToken = () => this.tokenSet?.access_token;
}

// -- export -- export the class
module.exports = {
    AuthAPI: AuthAPI
};

