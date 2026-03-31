# Security Configuration Guide

## 🔐 Production Checklist

### Before First Deploy

- [ ] **Generate API Key**
  ```bash
  openssl rand -hex 32
  # Output: 154ffa41b01ea3d1e2c3d62c723b7ed626d5820d015b586fe42bc556d1f1aa4b
  ```

- [ ] **Set Strict CORS**
  ```env
  CORS_ORIGINS=https://agentpad.yourdomain.com
  # Never use * in production
  ```

- [ ] **Enable HTTPS Only** (Vercel/Railway auto-configure this)

- [ ] **Add Rate Limit Monitoring**
  ```bash
  # Watch for 429 responses in logs
  # >100 429s/hour = potential abuse
  ```

- [ ] **Database Backup**
  ```bash
  # Daily cron
  0 2 * * * cp passkeys.db passkeys_backup_$(date +\%Y\%m\%d).db
  ```

### Deployment

- [ ] **Vercel**: Enable "Force HTTPS" in project settings
- [ ] **Railway**: Add domain, automatic TLS enabled
- [ ] **DigitalOcean VPS**: Install Let's Encrypt via Certbot

### Ongoing

- [ ] **Rotate API Key** every 6 months
- [ ] **Monitor Logs** for failed auth attempts
- [ ] **Update Dependencies** monthly
- [ ] **Security Audit** quarterly

## 🚨 Incident Response

### Compromised API Key
1. Generate new key: `openssl rand -hex 32`
2. Update backend `.env` → Redeploy
3. Update frontend `.env.local` → Redeploy
4. Log all activity from old key (audit trail)

### Suspicious Activity
1. Block IP at CDN level (Cloudflare)
2. Lower rate limit: `RATE_LIMIT_MAX=50`
3. Enable verbose logging: `DEBUG=*`
4. Investigate source within 24 hours

### Database Breach
1. **Don't panic**: Only public keys stored (no private keys!)
2. Rotate API key immediately
3. Notify affected users
4. Review access logs
5. Consider adding encryption layer

---

**Remember**: Passkey private keys NEVER leave users' devices. A backend breach compromises only credential IDs and public keys, not the ability to authenticate.
