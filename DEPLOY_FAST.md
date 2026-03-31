# 🚀 Deploy to Vercel in 60 Seconds

## Step 1: Install Vercel CLI (One-time)
```bash
npm i -g vercel
```

## Step 2: Deploy
```bash
cd /home/agent/openclaw/agentpad-backend
vercel --prod
```

### Interactive Prompts:
1. **Set up and deploy?** → `Y`
2. **Which scope?** → Select your account
3. **Link to existing project?** → `N` (first deploy)
4. **Project name?** → `agentpad-backend` (or your choice)
5. **In which directory is your code?** → `./`
6. **Want to override settings?** → `N`

## Step 3: Add Environment Variables
```bash
vercel env add API_KEY production
# Paste: 154ffa41b01ea3d1e2c3d62c723b7ed626d5820d015b586fe42bc556d1f1aa4b

vercel env add CORS_ORIGINS production
# Paste: https://agentpad.vercel.app,http://localhost:3000

vercel env add NODE_ENV production
# Paste: production
```

## Step 4: Get Your URL
```bash
vercel ls
# Output: https://agentpad-backend.vercel.app
```

## Step 5: Update Frontend
Edit `agentpad-frontend/.env.local`:
```env
NEXT_PUBLIC_KEY_MANAGER_URL=https://agentpad-backend.vercel.app
NEXT_PUBLIC_KEY_MANAGER_API_KEY=154ffa41b01ea3d1e2c3d62c723b7ed626d5820d015b586fe42bc556d1f1aa4b
```

## ✅ Done! Test It
```bash
curl https://agentpad-backend.vercel.app/health
# {"status":"healthy",...}

# Frontend now uses remote key manager for cross-device sync!
```

---

## Alternative: Vercel Dashboard (No CLI)

1. Go to https://vercel.com/new
2. Select `agentpad-backend` repo
3. Click "Deploy"
4. Go to Settings → Environment Variables
5. Add:
   ```
   API_KEY = 154ffa...4b
   CORS_ORIGINS = https://agentpad.vercel.app,http://localhost:3000
   NODE_ENV = production
   ```
6. Redeploy: Settings → Git → Triggers → Deploy

---

## Troubleshooting

### "404 Not Found"
→ Check `vercel.json` routes are correct
→ Ensure `src/index.ts` has `app.listen(port)`

### "CORS Error"
→ Verify `CORS_ORIGINS` includes your frontend domain
→ Add `OPTIONS` to allowMethods

### "API Key Invalid"
→ Ensure `API_KEY` in Vercel env matches frontend `NEXT_PUBLIC_KEY_MANAGER_API_KEY`
→ Redeploy after changing env vars

---

**Production URL**: `https://agentpad-backend.vercel.app`  
**Health Check**: `GET /health`  
**Docs**: `GET /`
