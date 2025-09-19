# usage inside an Electron app
const { Auth } = require('svAuth');

const auth = new Auth({
  kcUrl: process.env.KC_URL,           // Keycloak base (realm URL)
  clientId: process.env.KC_CLIENT_ID
});

await auth.init();

await auth.login();                     // opens browser + callback
const token = await auth.getAccessToken();
await auth.logout();

