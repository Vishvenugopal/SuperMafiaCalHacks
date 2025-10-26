# SIMPLE DEMO - No Python Required!

## 🎯 The Problem
Running terminal commands and Python agents is annoying for a demo. Let's make it **dead simple**.

## ✅ New Simple Solution

### **Option 1: Just Use the Werewolf Mode (Easiest)**

Your existing Werewolf mode already works perfectly! It has:
- ✅ AI narrator (uses your Baseten/JanitorAI)
- ✅ Voice recognition
- ✅ Multiple players
- ✅ Full game logic

**To demo:**
1. Run: `npm run dev`
2. Open: `http://localhost:3000`
3. Click "Werewolf"
4. Add players
5. Start game
6. Pass device around (or use one device per player on same WiFi)

**For friends to join on their devices:**
1. Find your IP: `ipconfig`
2. Friends go to: `http://YOUR_IP:3000`
3. Everyone plays Werewolf mode
4. Each person on their own device

**No Python needed. No terminal commands. Just works!**

---

### **Option 2: Simplified Judge Mode (No Python)**

I can modify the Judge mode to work without Python:

**How it would work:**
- Remove the Python agent requirement
- Use your existing `/api/host` endpoint directly
- Players still join from multiple devices
- Judge responses come from your Baseten/JanitorAI
- All through the browser - no Python!

**Would you like me to implement this?**

---

## 🚀 For CalHacks Demo - Use Werewolf Mode!

### **Step 1: Start**
```bash
npm run dev
```

### **Step 2: Open Browser**
```
http://localhost:3000
```

### **Step 3: Demo**
1. Click "Werewolf"
2. Add 4-5 players
3. Assign roles
4. Start game
5. Show off the AI narrator
6. Show off voice recognition

### **Step 4: Multi-Device (Optional)**
- Find IP: `ipconfig` → 192.168.1.X
- Friends: `http://192.168.1.X:3000/werewolf`
- Each creates their own player

---

## 💡 What to Tell Judges

"We built an AI-powered social deduction game using:
- **Next.js** for the frontend
- **LiveKit** for real-time voice (or Web Speech API as fallback)
- **Baseten/JanitorAI** for custom AI narrator
- **Multi-device support** - everyone on their own phone
- Built in [X] days for CalHacks!"

**Show them:**
1. The AI narrator responding to game events
2. Voice recognition working
3. Multiple players on different devices
4. The game logic and UI

---

## 🎯 Recommendation

**For CalHacks demo: Use Werewolf mode!**

Why?
- ✅ Already fully working
- ✅ No Python setup needed
- ✅ No terminal commands
- ✅ Just `npm run dev` and go
- ✅ Impressive AI narrator
- ✅ Multi-device capable
- ✅ Full game logic implemented

The Judge mode is cool, but adds complexity. The Werewolf mode is your **polished, working demo**.

---

## 🔧 If You Really Want Judge Mode Without Python

I can create a version that:
1. Runs entirely in Next.js (no Python)
2. Uses your existing AI endpoints
3. Works on multiple devices
4. Single command to start: `npm run dev`

**Should I build this?** Or just use Werewolf mode for the demo?

Let me know and I'll make it happen! 🚀
