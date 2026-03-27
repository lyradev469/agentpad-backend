# AgentPad Remote Key Manager

A lightweight HTTP backend for Tempo passkey authentication, enabling cross-device sync and account recovery.

## 🔐 What It Does

Standard passkey implementations store credentials **locally** (in browser localStorage). This backend centralizes storage so:
- Users can authenticate from any device
- Credentials persist even if browser cache is cleared
- Account recovery is possible
- Teams can share agent identities (optional)

**Critical Note**: Private keys **NEVER** leave the user's device. Only public keys and credential IDs are stored here, following WebAuthn security model.

## 🏗️ Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Browser    │      │   Backend    │      │    SQLite    │
│  (WebAuthn)  │◄────►│  (Hono API)  │◄────►│   (Local)    │
└──────────────┘      └──────────────┘      └──────────────┘
       │                     │
       │  1. Sign-up/up      │  2. Store/Retrieve
       │  (biometric)        │     public keys only
       ▼                     ▼
  [Secure Enclave]     [Passkeys Table]
  (Private Key)        (Credential IDs)
```

## 🚀 Quick Start (Development)

### 1. Install Dependencies
```bash
cd agentpad-backend
npm install
# or
bun install
```

### 2. Set Environment Variables
```bash
export API_KEY="my-secret-key-change-me"
export PORT=3001
```

### 3. Run Development Server
```bash
npm run dev
# Server starts at http://localhost:3001
```

### 4. Test API
```bash
# Health check
curl http://localhost:3001/health

# List endpoints
curl http://localhost:3001/
```

## 📡 API Reference

### Base URL
`http://localhost:3001` (dev) | `https://your-domain.com` (prod)

### Authentication
All endpoints (except `/health`) require `X-API-Key` header.

---

### `POST /keys`
Register a new passkey credential.

**Request:**
```json
{
  "userId": "0x123...abc",
  "credentialId": "base64-encoded-credential-id",
  "publicKey": "base64-encoded-public-key"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Passkey stored",
  "userId": "0x123...abc"
}
```

---

### `GET /keys/:userId`
Retrieve all passkeys for a user.

**Response:**
```json
{
  "success": true,
  "userId": "0x123...abc",
  "credentials": [
    {
      "credential_id": "...",
      "public_key": "...",
      "counter": 0
    }
  ]
}
```

---

### `GET /credential/:credentialId`
Retrieve a specific credential.

**Response:**
```json
{
  "success": true,
  "credential": {
    "user_id": "0x123...abc",
    "public_key": "...",
    "counter": 5
  }
}
```

---

### `PUT /counter/:credentialId`
Update authentication counter (after successful login).

**Request:**
```json
{ "counter": 6 }
```

---

### `DELETE /keys/:userId/:credentialId`
Remove a passkey.

**Response:**
```json
{ "success": true, "message": "Credential deleted" }
```

---

### `GET /health`
Health check (no auth required).

**Response:**
```json
{ "status": "healthy", "timestamp": "2026-03-27T08:00:00Z" }
```

## 🔧 Frontend Integration

Update your Wagmi config to use this backend:

```typescript
// lib/wagmi.ts
import { KeyManager, webAuthn } from 'wagmi/tempo'

export const config = createConfig({
  chains: [tempoModerato],
  connectors: [
    webAuthn({
      keyManager: KeyManager.http({
        baseUrl: process.env.NEXT_PUBLIC_KEY_MANAGER_URL,
        fetchOptions: {
          headers: {
            'X-API-Key': process.env.NEXT_PUBLIC_KEY_MANAGER_API_KEY,
          },
        },
      }),
    }),
  ],
  transports: {
    [tempoModerato.id]: http(),
  },
})
```

### Environment Variables (Frontend)
```bash
NEXT_PUBLIC_KEY_MANAGER_URL=https://your-backend.com
NEXT_PUBLIC_KEY_MANAGER_API_KEY=your-api-key
```

## 🛡️ Security Checklist (Production)

- [ ] Change default `API_KEY` to a strong secret
- [ ] Enable HTTPS only (block HTTP)
- [ ] Add rate limiting (e.g., 100 req/min per IP)
- [ ] Add API key rotation support
- [ ] Encrypt database at rest
- [ ] Set up backup strategy for SQLite
- [ ] Add monitoring/logging (e.g., Sentry)
- [ ] Use environment variables for secrets (never commit)
- [ ] Enable CORS for your frontend domain only
- [ ] Add authentication for admin endpoints (optional)

## 🚢 Deployment Options

### Vercel (Recommended)
1. Push `agentpad-backend` to GitHub
2. Import in Vercel
3. Set environment variables
4. Deploy

```bash
# vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev"
}
```

### Railway
1. Connect GitHub repo
2. Auto-detects Bun/Node
3. Set env vars in dashboard
4. Deploy

### Self-hosted (VPS)
```bash
# Docker
docker run -d \
  -p 3001:3001 \
  -v ./data:/app/data \
  -e API_KEY=your-secret \
  agentpad-backend:latest
```

## 📊 Monitoring

### Key Metrics to Track
- Successful registrations
- Failed authentications
- API latency (p95, p99)
- Error rates

### Logging
```typescript
// Add to src/index.ts
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} - ${duration}ms`)
})
```

## 🧪 Testing

### Unit Tests (Jest)
```bash
npm install --save-dev jest @types/jest ts-jest
npx tsc && npx jest
```

### Integration Tests
```bash
# Start dev server
npm run dev &

# Run tests
curl -X POST http://localhost:3001/keys \
  -H "X-API-Key: my-secret-key" \
  -d '{"userId":"test","credentialId":"abc","publicKey":"xyz"}'
```

## 📚 Resources

- [Wagmi Tempo Docs](https://wagmi.sh/tempo/keyManagers/http)
- [WebAuthn Spec](https://www.w3.org/TR/webauthn-2/)
- [Hono Framework](https://hono.dev/)
- [Tempo Passkey Guide](https://docs.tempo.xyz/guide/use-accounts/embed-passkeys)

## 🤝 Contributing

1. Fork repo
2. Create feature branch
3. Commit changes
4. Push and open PR

## 📄 License

MIT - Open Source

---

**Built by Lyrantic** for AgentPad  
**Version**: 1.0.0  
**Last Updated**: 2026-03-27
