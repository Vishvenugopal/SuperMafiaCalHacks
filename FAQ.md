# Frequently Asked Questions

## API Keys & Setup

### Q: Do my friends need the same API keys to join?
**A: NO!** Only you need API keys. Here's why:

```
YOU (Host):
  - Have API keys in .env.local
  - Run the website (npm run dev)
  - Run the agent (python agent/multi_agent.py)
  - Your backend calls Baseten/JanitorAI

FRIENDS:
  - Just open a browser
  - Go to your URL
  - Enter room code
  - Play!
```

Your friends are just clients connecting to YOUR server. The API keys stay on your machine, never exposed.

---

## Localhost vs Vercel

### Q: Will it work on localhost instead of Vercel?
**A: YES, perfectly for demo!**

**Localhost Setup (Same WiFi):**
```
You:       http://localhost:3000
Friend 1:  http://192.168.1.5:3000  (your IP)
Friend 2:  http://192.168.1.5:3000
Friend 3:  http://192.168.1.5:3000
```

Find your IP:
- Windows: `ipconfig` → IPv4 Address
- Mac: `ifconfig` → inet

**Advantages:**
- ✅ No deployment needed
- ✅ Free
- ✅ Easy to debug
- ✅ Perfect for CalHacks demo

**Limitations:**
- ⚠️ Friends must be on same WiFi
- ⚠️ If your laptop sleeps, server stops

---

### Q: What about Vercel deployment?
**A: Works, but agent needs to run locally**

**Vercel Setup:**
```
Vercel (Cloud):        Your Laptop:
├─ Frontend            └─ python agent/multi_agent.py
└─ API routes             (must stay running)

Friends anywhere → Vercel URL → Your agent via LiveKit
```

**To deploy:**
```bash
vercel deploy
```

**Important:** The Python agent CANNOT run on Vercel (serverless limitation). You must run it on:
- Your laptop (during demo)
- Railway/Render (for production)
- A VPS (for scaling)

For CalHacks demo: Just use localhost. It's simpler!

---

## Agent & Rooms

### Q: One agent per room or one agent total?
**A: ONE AGENT PER ROOM!**

**Old design (bad):**
```
[Single Agent] ←→ [Room A] [Room B] [Room C]
❌ Agent gets confused between games
```

**New design (good):**
```
[Agent A] ←→ [Room A]
[Agent B] ←→ [Room B]  
[Agent C] ←→ [Room C]
✅ Each room has dedicated Judge
```

**How it works:**
```bash
# Terminal 2
🤖 > spawn ABC123   # Agent joins room ABC123
🤖 > spawn XYZ789   # New agent joins room XYZ789
🤖 > list
Active agents: ABC123, XYZ789
```

Each agent is independent. You can run 10+ games simultaneously!

---

## Network & Connectivity

### Q: How do friends on different devices connect?
**A: Through LiveKit Cloud**

```
[Friend's Phone]          [LiveKit Cloud]          [Your Laptop]
     │                          │                        │
     ├──── Voice ──────────────►│◄──── Voice ───────────┤
     │                          │                        │
     ├──── Room Code ───────────┼──────► Agent spawned  │
     │                          │        for that code   │
     └──── Receives Judge ◄─────┤                        │
              response          │                        │
```

**Flow:**
1. Friend opens your URL
2. Enters room code "ABC123"
3. Your Next.js backend generates LiveKit token
4. Friend's browser connects to LiveKit Cloud
5. Your agent (also on LiveKit) sees the friend join
6. Voice flows through LiveKit, not your home network

**Why this works:**
- LiveKit Cloud handles ALL voice traffic
- Your laptop just sends commands to LiveKit
- Friends never directly connect to your laptop
- Works even with strict NAT/firewalls

---

## Scaling & Performance

### Q: How many concurrent games can I run?
**A: Depends on your setup**

**For Demo (Localhost):**
```
Laptop CPU:        ~5-10 concurrent agents
LiveKit Free:      50GB/month bandwidth
Baseten/Janitor:   Rate limits apply

Realistic demo:    3-5 games, 15-20 total players
```

**For Production (Vercel + Railway):**
```
Frontend:          Unlimited players
LiveKit Cloud:     100s of concurrent rooms
Agents:            10-50 per Railway instance

Realistic prod:    50-100 games, 200-400 players
```

### Q: What if my laptop goes to sleep?
**A: Everything stops!**

**Solutions:**
1. Disable sleep mode during demo
2. Deploy to Railway for 24/7 uptime
3. Use a desktop/server instead of laptop

For CalHacks: Just keep laptop awake and plugged in!

---

## Security & Privacy

### Q: Are my API keys exposed?
**A: NO, they're safe**

```
.env.local           ← API keys here
  │
  ├─ NEVER sent to browser
  ├─ Only used by YOUR backend
  └─ Friends never see them
```

**What friends receive:**
- LiveKit token (expires in 2 hours)
- Room name
- No API keys ever

**What's public:**
- Your IP address (if using localhost)
- Room codes (but they're random)

### Q: Can someone join without the room code?
**A: NO**

- Room codes are required
- Can't browse/discover rooms
- Each code is unique and random
- No code = no entry

---

## Cost & Billing

### Q: What will this cost me?
**A: For demo, $0!**

**Free Tier Usage:**
```
Vercel:            Unlimited (Frontend)
LiveKit Cloud:     50GB/month (plenty for demo)
Railway:           500 hours/month (if you deploy there)
Your APIs:         Whatever you already have

Total for demo:    $0
```

**If it goes viral:**
```
LiveKit:           $99/month (pro plan)
Railway:           $20/month (agent hosting)
Baseten/Janitor:   Pay per API call
Vercel:            Still free!

Total:             ~$120-150/month for 100s of users
```

For CalHacks: You won't hit any limits. Don't worry about cost!

---

## Demo Day Tips

### Q: What if the internet is bad at the venue?
**A: Use mobile hotspot**

1. Create hotspot on your phone
2. Connect laptop to hotspot
3. Friends connect to same hotspot
4. Everything uses cellular data (more reliable than venue WiFi)

### Q: What's the backup plan?
**A: Multiple options**

1. **Screen recording**: Record a perfect run beforehand
2. **Slides**: Explain the tech with screenshots
3. **Code walkthrough**: Show the agent/frontend code
4. **Single device**: Worst case, demo on one device passing around

### Q: How do I show off the tech?
**A: Emphasize these points**

1. "Real-time voice with LiveKit Cloud"
2. "Custom AI Judge using Baseten/JanitorAI"
3. "Multi-device architecture - everyone on their own device"
4. "Scalable - each room gets dedicated AI"
5. "Built in [X] days for CalHacks"

Show the agent spawn command. Show the code. It's impressive!

---

## Quick Command Reference

```bash
# Terminal 1 - Start website
npm run dev

# Terminal 2 - Start agent manager
python agent/multi_agent.py

# In agent manager
spawn ABC123      # Spawn agent for room ABC123
list              # Show all active agents
remove ABC123     # Remove agent
quit              # Shut down all

# Find your IP (for friends)
ipconfig          # Windows
ifconfig          # Mac/Linux

# Deploy to Vercel
vercel deploy
```

---

## Still Have Questions?

Check these files:
- `START_DEMO.md` - Step-by-step demo setup
- `MULTI_DEVICE_SETUP.md` - Technical details
- `QUICKSTART.md` - Original quick start guide

Or just try it! The worst that can happen is you restart the agent. Good luck! 🚀
