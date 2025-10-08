# Sphere Vault Auth

Enterprise-grade Keycloak authentication wrapper for Electron applications with secure token management.

## Features

- 🔐 PKCE OAuth2/OpenID Connect flow
- 🔄 Automatic token refresh with retry logic
- 💾 Secure token storage using system keychain (keytar)
- 🛡️ Role-based access control
- 📱 Electron-optimized
- 🔧 Configurable and extensible

## Installation

### As npm package (recommended)
```bash
# In sphere-vault-auth folder
npm link

# In your Electron app folder
npm link wrapper