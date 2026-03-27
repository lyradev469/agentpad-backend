# Deployment Guide: Remote Key Manager

## Prerequisites
- Node.js 18+ or Bun 1.0+
- Git
- GitHub account
- Vercel/Railway account (for free hosting)

## Option 1: Vercel (Recommended - 5 minutes)

### Step 1: Push to GitHub
```bash
cd agentpad-backend
git init
git add .
git commit -m "Initial commit: Remote Key Manager"
git branch -M main
git remote add origin https://github.com/lyradev469/agentpad-backend.git
git push -u origin main
```

### Step 2: Import in Vercel
1. Go to https://vercel.com/new
2. Import `agentpad-backend` repository
3. Configure:
   ```
   Framework: Other
   Build Command: echo "No build needed"
   Output Directory: .
   Install Command: npm install
   ```
4. Add Environment Variables:
   ```
   API_KEY = your-super-secret-key
   NODE_ENV = production
   ```
5. Deploy

### Step 3: Get Your URL
Vercel will give you: `https://agentpad-backend.vercel.app`

### Step 4: Update Frontend
```bash
# In agentpad-frontend/.env.local
NEXT_PUBLIC_KEY_MANAGER_URL=https://agentpad-backend.vercel.app
```

---

## Option 2: Railway (Alternative - 5 minutes)

### Step 1: Connect GitHub
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select `agentpad-backend`

### Step 2: Configure
- Auto-detects Node.js
- Add secrets: `API_KEY`, `NODE_ENV`

### Step 3: Deploy
- Railway provides HTTPS URL automatically

---

## Option 3: Self-Hosted (VPS/DigitalOcean)

### Step 1: Install Dependencies
```bash
# On your VPS
cd ~
git clone https://github.com/lyradev469/agentpad-backend.git
cd agentpad-backend
npm install
```

### Step 2: Run with PM2
```bash
npm install -g pm2
pm2 start src/index.ts --name "key-manager"
pm2 save
pm2 startup
```

### Step 3: Configure Nginx (reverse proxy)
```nginx
server {
    listen 80;
    server_name keys.agentpad.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 4: Enable HTTPS (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d keys.agentpad.yourdomain.com
```

---

## Verification

### 1. Health Check
```bash
curl https://your-backend-url.com/health
# Expected: {"status":"healthy",...}
```

### 2. Test Registration
```bash
curl -X POST https://your-backend-url.com/keys \
  -H "X-API-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "0x123abc",
    "credentialId": "test-cred-id",
    "publicKey": "test-public-key"
  }'
# Expected: {"success":true,"message":"Passkey stored"}
```

### 3. Test Retrieval
```bash
curl https://your-backend-url.com/keys/0x123abc \
  -H "X-API-Key: your-secret-key"
# Expected: {"success":true,"credentials":[...]}
```

---

## Frontend Integration

Update `lib/wagmi.ts` in AgentPad:

```typescript
import { KeyManager, webAuthn } from 'wagmi/tempo'

// Production mode: use remote key manager
export const config = createConfig({
  chains: [tempoModerato],
  connectors: [
    webAuthn({
      keyManager: process.env.NEXT_PUBLIC_KEY_MANAGER_URL 
        ? KeyManager.http({
            baseUrl: process.env.NEXT_PUBLIC_KEY_MANAGER_URL,
            fetchOptions: {
              headers: {
                'X-API-Key': process.env.NEXT_PUBLIC_KEY_MANAGER_API_KEY!,
              },
            },
          })
        : KeyManager.localStorage(), // Fallback to local for dev
    }),
    // ... other wallets
  ],
  // ... rest of config
})
```

---

## Troubleshooting

### "CORS error" in browser
- Ensure backend CORS allows your frontend domain
- Check `FRONTEND_URL` in backend env vars

### "401 Unauthorized"
- Verify `X-API-Key` header is set correctly
- Check for typos in environment variables

### Database errors
- Ensure write permissions in Vercel (use Vercel KV or Postgres instead)
- For self-hosted, check file permissions on `passkeys.db`

### Slow responses
- Add CDN (Cloudflare) in front
- Use indexed queries

---

## Security Best Practices

### 1. API Key Rotation
```bash
# Generate new key
openssl rand -hex 32

# Update both backend and frontend env vars
```

### 2. Rate Limiting (add to backend)
```typescript
import { rateLimit } from 'hono/rate-limit'

app.use('/keys/*', rateLimit({
  window: 60, // 60 seconds
  max: 100,   // 100 requests
}))
```

### 3. HTTPS Only
- Force HTTPS in Vercel/Railway settings
- Add HSTS header in backend

### 4. Input Validation
```typescript
// Add before storing
if (!credentialId.match(/^[a-zA-Z0-9_-]+$/)) {
  return c.json({ error: 'Invalid credential ID' }, 400)
}
```

---

## Monitoring

### Uptime Monitoring
Use UptimeRobot or Pingdom to check `/health` every 5 minutes.

### Logs
- Vercel: Built-in logs at `vercel.com`
- Railway: Logs in dashboard
- Self-hosted: `pm2 logs key-manager`

### Error Tracking
Integrate Sentry:
```bash
npm install @sentry/hono
```

---

## Cost Estimate

| Platform | Free Tier | Pro Tier |
|----------|-----------|----------|
| Vercel | 100GB bandwidth/mo | $20/mo |
| Railway | $5 credit/mo | $5/mo+ |
| DigitalOcean | N/A | $5/mo VPS |

**Verdict**: Vercel free tier is sufficient for <10k users.

---

## Next Steps

1. [ ] Deploy backend
2. [ ] Update frontend env vars
3. [ ] Test passkey sync across devices
4. [ ] Add rate limiting
5. [ ] Set up monitoring
6. [ ] Document for users

---

**Ready to deploy?** Run:
```bash
cd agentpad-backend
git init && git add . && git commit -m "Ready for production"
vercel --prod  # If using Vercel
```

**Questions?** Check `README.md` or [Tempo Docs](https://docs.tempo.xyz)
