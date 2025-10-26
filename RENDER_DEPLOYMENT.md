# Deploy to Render

## Why Render?
- ✅ Free HTTPS (fixes mic permissions)
- ✅ Persistent server (multi-device works)
- ✅ Custom domain support (even on free tier)
- ✅ Auto-deploys from GitHub

## Step-by-Step Deployment

### 1. Push Your Code to GitHub

Make sure all your latest changes are committed and pushed:

```bash
git add .
git commit -m "Add Render deployment config"
git push origin main
```

### 2. Create Render Account

1. Go to https://render.com
2. Sign up with GitHub (easiest)
3. Authorize Render to access your repositories

### 3. Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `SuperMafiaCalHacks`
3. Render will auto-detect the Next.js app

**Configure the service:**
- **Name:** `super-mafia-game` (or your choice)
- **Region:** Choose closest to you
- **Branch:** `main`
- **Root Directory:** (leave empty)
- **Runtime:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Plan:** `Free`

### 4. Add Environment Variables (Optional)

If you're using AI features, add these in the Render dashboard:

- `BASETEN_API_KEY` = your Baseten key
- `BASETEN_MODEL_ID` = your model ID
- `JANITOR_AI_API_KEY` = your JanitorAI key
- `JANITOR_AI_CHARACTER_ID` = your character ID
- `ELEVENLABS_API_KEY` = your ElevenLabs key
- `ELEVENLABS_VOICE_ID` = your voice ID

### 5. Deploy!

Click **"Create Web Service"**

- First build takes 3-5 minutes
- Watch the logs for any errors
- Once complete, you'll get a URL like: `https://super-mafia-game.onrender.com`

### 6. Test Multi-Device

1. Open the Render URL on your computer
2. Create a room
3. Open the same URL on your phone
4. Join with the room code
5. ✅ Should work!

## 🌐 Add Your Custom Domain

### Option A: Root Domain (example.com)

1. In Render dashboard → Your service → **Settings**
2. Scroll to **Custom Domain**
3. Click **"Add Custom Domain"**
4. Enter: `yourdomain.com`
5. Render shows DNS instructions:
   ```
   Type: A
   Name: @
   Value: 216.24.57.1
   ```
6. Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
7. Add the A record as shown
8. Wait 5-60 minutes for DNS propagation
9. ✅ Your site will be live at `https://yourdomain.com`

### Option B: Subdomain (game.example.com)

1. Add custom domain in Render: `game.yourdomain.com`
2. Render shows:
   ```
   Type: CNAME
   Name: game
   Value: super-mafia-game.onrender.com
   ```
3. Add CNAME record to your DNS
4. Wait for propagation
5. ✅ Live at `https://game.yourdomain.com`

### SSL Certificate

- Render automatically provisions SSL via Let's Encrypt
- Usually ready in 5-15 minutes after DNS propagates
- Your site will be HTTPS with a valid certificate 🔒

## 📱 Free Tier Limits

Render free tier:
- ✅ 750 hours/month (enough for continuous use)
- ⚠️ Spins down after 15 min of inactivity
- ⏱️ Takes ~30 seconds to wake up on first request
- ✅ Unlimited custom domains
- ✅ Free SSL certificates

**Wake-up tip:** First player might see a loading screen for 30s. After that, it's fast!

## 🔄 Auto-Deploy

Any time you push to GitHub `main` branch:
- Render automatically rebuilds
- Takes 2-3 minutes
- No manual action needed

## 🐛 Troubleshooting

### Build fails
Check Render logs. Common issues:
- Missing dependencies → Run `npm install` locally first
- TypeScript errors → Fix locally, then push

### Site loads but rooms don't work
- Check if API routes are accessible: `https://yoursite.com/api/room`
- Should return JSON (not 404)
- Check environment variables are set

### Mic still doesn't work
- Verify site is HTTPS (should have 🔒 in browser)
- Some browsers block mic on localhost tunnels
- Try different browser

## 🎉 Success Checklist

- [ ] Render deployment successful
- [ ] Can access site via Render URL
- [ ] HTTPS working (🔒 in address bar)
- [ ] Can create a room
- [ ] Can join room from second device
- [ ] Mic permissions work
- [ ] Custom domain added (optional)
- [ ] SSL certificate active on custom domain

## Need Help?

Common Render docs:
- [Custom Domains](https://render.com/docs/custom-domains)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Deploy Logs](https://render.com/docs/logs)
