# SuperMafia - CalHacks Demo

## 🎯 ONE COMMAND TO START

```bash
npm run dev
```

That's it! No Python. No terminal commands. Just works.

---

## 🚀 Quick Demo Guide

### Step 1: Start the App
```bash
npm run dev
```

Wait for: `✓ Ready on http://localhost:3000`

### Step 2: Open in Browser
```
http://localhost:3000
```

You'll see two game modes:
- **Werewolf** (single/multi-device)
- **AI Judge** (multi-device)

---

## 🎮 Demo: AI Judge Mode (Multi-Device)

### On Your Computer:
1. Open `http://localhost:3000`
2. Click **"AI Judge"**
3. Enter your name: "Vish"
4. Click **"Create New Room"**
5. You get a code like: **ABC123**

### Tell Your Friends:
**"Go to http://192.168.1.X:3000 and enter room code ABC123"**

(Replace X with your IP from `ipconfig`)

### Friends Do This:
1. Open phone browser
2. Go to: `http://192.168.1.X:3000`
3. Click "AI Judge"
4. Enter their name
5. Enter room code: `ABC123`
6. Join!

### How to Play:
1. **Press and hold** the microphone 🎙️
2. Speak to the AI Judge
3. **Release** when done
4. Judge responds using your Baseten/JanitorAI
5. Next player's turn!

---

## 🎮 Alternative: Werewolf Mode

Already has full game logic, AI narrator, and works great!

1. Open `http://localhost:3000`
2. Click **"Werewolf"**
3. Add players
4. Start game
5. Pass device around or everyone joins on their own device

---

## 🌐 Friends on Different WiFi?

### Option 1: Mobile Hotspot (Easiest)
1. Create hotspot on your phone
2. Connect your laptop to hotspot
3. Friends connect to same hotspot
4. Find new IP with `ipconfig`
5. Share that IP

### Option 2: Deploy to Vercel
```bash
vercel deploy
```

Get URL like: `https://supermafia.vercel.app`

Friends can join from anywhere!

---

## ❓ FAQ

### Do friends need API keys?
**NO!** Only you need API keys in `.env.local`

### What if I don't have LiveKit configured?
The app works without LiveKit! It uses simple HTTP polling instead.

### How many players?
As many as you want! Each device connects independently.

### Does it cost money?
Your existing Baseten/JanitorAI usage. No extra costs.

### What if something breaks?
Just refresh the browser. That's it!

---

## 🎬 What to Show Judges

1. **Multi-device gameplay** - Everyone on their own phone
2. **AI responses** - Real Baseten/JanitorAI integration
3. **Simple UX** - No setup, just click and play
4. **The code** - Show them how clean it is!

**Say this:**
"We built an AI-powered social deduction game with multi-device support. Players join from their phones, talk to an AI Judge powered by Baseten/JanitorAI, and the AI makes decisions. Everything runs in Next.js - no complex backend needed!"

---

## 📁 Project Structure

```
app/
  ├─ page.tsx              # Home page
  ├─ werewolf/page.tsx     # Werewolf mode (full game)
  ├─ simple-judge/page.tsx # AI Judge mode (NEW!)
  └─ api/
      ├─ simple-agent/     # AI Judge logic (NEW!)
      ├─ host/             # Your existing AI endpoint
      └─ livekit-token/    # Token generation

No Python needed!
No terminal commands!
Just npm run dev!
```

---

## 🔥 Pro Tips

1. **Test beforehand** - Do a run with one friend
2. **Use memorable room codes** - "DEMO01" instead of random
3. **Screenshot your IP** - So you don't have to keep saying it
4. **Have backup** - Record a perfect run just in case
5. **Show the code** - It's actually really clean!

---

## 🐛 Troubleshooting

### "Friends can't connect"
- Make sure they're on same WiFi
- Give them `http://YOUR_IP:3000` not `localhost:3000`
- Find IP with `ipconfig`

### "AI not responding"
- Check `.env.local` has Baseten/JanitorAI keys
- Check terminal for API errors
- Try refreshing page

### "Page won't load"
- Make sure `npm run dev` is running
- Check for errors in terminal
- Try `http://localhost:3000` first

---

## ✅ What Changed

**Before:**
- Required Python agent
- Terminal commands
- Complex setup
- LiveKit configuration
- Agent per room

**Now:**
- Just `npm run dev`
- Everything in Next.js
- Works out of the box
- No extra dependencies
- Simple and reliable!

---

## 🚀 Ready for Demo

You're all set! Just:

1. `npm run dev`
2. Open browser
3. Create room
4. Share code
5. Play!

**Good luck at CalHacks!** 🎉
