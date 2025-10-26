# START HERE - Demo Setup

## ✅ Quick Answers to Your Questions

### **Do friends need the same API keys?**
**NO!** Only you (the host) need API keys. Your friends just:
1. Go to your URL (e.g., `http://192.168.1.5:3000`)
2. Enter the room code
3. Play!

They don't need ANY setup or API keys.

### **Does localhost work?**
**YES for demo!** On the same WiFi:
- You: `http://localhost:3000`
- Friends: `http://YOUR_IP:3000` (find IP with `ipconfig`)

**Vercel works too** but you'll need to run the agent on your laptop during the demo.

### **One agent per room?**
**YES!** The new `multi_agent.py` spawns one agent per room code.

---

## 🚀 Demo Setup (5 minutes)

### Step 1: Start the Website (Terminal 1)
```bash
npm run dev
```
Wait for: `✓ Ready in X.Xs`

### Step 2: Start the Agent Manager (Terminal 2)
```bash
python agent/multi_agent.py
```
You'll see:
```
🎮 SuperMafia Multi-Agent Manager
Commands:
  spawn <CODE>  - Spawn agent for room code
  list          - List all active agents
  quit          - Exit
🤖 >
```

### Step 3: Create a Room
1. Open browser: `http://localhost:3000`
2. Click "AI Judge"
3. Enter your name: "Host"
4. Click "Create New Room"
5. **Copy the room code** (e.g., `ABC123`)

### Step 4: Spawn Agent for That Room
Back in Terminal 2, type:
```
spawn ABC123
```
(Replace ABC123 with your actual code)

You'll see:
```
✅ Agent spawned for room: ABC123
```

### Step 5: Check the Web UI
The "AI Judge Status" should now show: **✓ Connected** (green)

### Step 6: Have Friends Join

**Option A: Same WiFi (Easy)**
1. Find your IP: Open Command Prompt, type `ipconfig`
2. Look for "IPv4 Address" (e.g., `192.168.1.5`)
3. Friends go to: `http://192.168.1.5:3000`
4. They enter the room code
5. They're in!

**Option B: Vercel (For Remote Friends)**
1. Deploy to Vercel: `vercel deploy`
2. Share the Vercel URL
3. Keep agent running on YOUR laptop
4. Friends join from anywhere

---

## 🎮 Playing the Game

### Starting
1. Wait for all players to join
2. Host clicks "Start Game"
3. Game begins!

### How to Talk
1. **Press and hold** the microphone button 🎙️
2. Speak to the AI Judge
3. **Release** to send
4. Wait for Judge to respond
5. Next player's turn

### Rules
- Only one person can talk at a time
- Judge listens and responds
- Judge makes elimination decisions
- Convince the Judge you're innocent!

---

## 🐛 Troubleshooting

### "Agent won't connect"
- Make sure you typed `spawn <CODE>` with the correct room code
- Check Terminal 2 for errors
- Verify .env.local has LiveKit credentials

### "Friends can't join"
- Make sure they're on the same WiFi
- Give them `http://YOUR_IP:3000` not `localhost:3000`
- Check firewall isn't blocking port 3000

### "No response from Judge"
- Check Terminal 2 for API errors
- Make sure Baseten/JanitorAI keys are in .env.local
- Try refreshing the page

### "Multiple rooms"
Just spawn more agents:
```
spawn ABC123
spawn DEF456
spawn XYZ789
```
Each room gets its own Judge!

---

## 📊 During Demo

### Show off these features:
1. **Multi-device**: Everyone on their own phone
2. **Real-time voice**: Powered by LiveKit
3. **AI Judge**: Uses your custom Baseten/JanitorAI setup
4. **Push-to-talk**: Queue system prevents talking over each other
5. **Scalable**: Each room gets dedicated AI

### If something breaks:
1. Check Terminal 1 (Next.js) for frontend errors
2. Check Terminal 2 (Agent) for backend errors
3. Worst case: Refresh pages and `spawn` agent again

---

## 🎯 What's Running Where

```
[Your Laptop]
  ├─ Terminal 1: npm run dev (Frontend)
  ├─ Terminal 2: python agent/multi_agent.py (AI Judges)
  └─ Browser: http://localhost:3000

[LiveKit Cloud]
  └─ Handles all voice communication

[Baseten/JanitorAI]
  └─ Provides AI responses

[Friends' Devices]
  └─ Browser: http://YOUR_IP:3000
```

Everything routes through YOUR laptop during the demo. No cloud deployment needed for CalHacks!

---

## ⚡ Pro Tips

1. **Test beforehand**: Run through once with 2 devices before the actual demo
2. **Have backup**: Take a screen recording in case of demo gods
3. **Explain the tech**: "Real-time voice with LiveKit, custom AI with Baseten"
4. **Show the code**: The agent manager code is actually pretty cool
5. **Room codes**: Use memorable codes like "DEMO01", "TEST99" for easier demo

Good luck at CalHacks! 🚀
