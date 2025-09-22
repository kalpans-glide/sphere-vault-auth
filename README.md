# usage inside an Electron app
```
const { Auth } = require('svAuth');

const auth = new Auth({
  kcUrl: process.env.KC_URL,           // Keycloak base (realm URL)
  clientId: process.env.KC_CLIENT_ID
});

await auth.init();

await auth.login();                     // opens browser + callback
const token = await auth.getAccessToken();
await auth.logout();
```

# requirements
    "dotenv": "^17.2.2",
    "electron": "^38.1.2",
    "express": "^5.1.0",
    "openid-client": "^5.7.1"

# .env file
```
KC_URL=https://keycloak-base-url/realms/your-realm
CLIENT_ID=your-keycloak-client-id
```

---

<div align="center">
  <p>Built with ❤️ by Kalpan Shah</p>
  <p>© 2025 Me</p>
</div>