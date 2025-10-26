# Quick Start - Multi-Device Judge Mode

## Your .env.local is already set up! ✅

You have:
- ✅ LiveKit credentials
- ✅ Baseten API
- ✅ JanitorAI API
- ✅ ElevenLabs TTS

## Installation (One-time)

```bash
pip install -r agent/requirements.txt
```

## Running the Game

### Terminal 1 - Start the Website
```bash
npm run dev
```

### Terminal 2 - Start the AI Judge
```bash
python agent/simple_judge.py
```

When prompted, enter the room code (you'll create this in step 3)

### Step 3 - Create a Game
1. Open http://localhost:3000
2. Click "AI Judge"
3. Enter your name
4. Click "Create New Room"
5. **Copy the 6-character room code** (e.g., `ABC123`)
6. In Terminal 2, enter this code when prompted
7. Wait for "AI Judge" status to show "✓ Connected"
8. Click "Start Game"

### Step 4 - Join from Other Devices
On your phone or another computer:
1. Go to http://YOUR_COMPUTER_IP:3000
2. Click "AI Judge"  
3. Enter your name
4. Enter the room code
5. Click "Join Room"

## How to Play

- **Hold** the microphone button to talk to the Judge
- **Release** to send your message
- Judge responds using your Baseten/JanitorAI setup
- Only one person can talk at a time

## Troubleshooting

**"Agent won't connect"**
- Make sure you entered the same room code in both places
- Room code format: `ABC123` (6 characters)
- Check Terminal 2 for error messages

**"Can't find python"**
Try: `python3 agent/simple_judge.py`

**"Module not found"**
Run: `pip install -r agent/requirements.txt`

**"Can't join from phone"**
- Make sure phone is on same WiFi
- Find your computer's IP: `ipconfig` (Windows) or `ifconfig` (Mac)
- Use `http://192.168.x.x:3000` (replace with your IP)

## Architecture

```
[Player Phone 1] ─┐
[Player Phone 2] ─┤
[Player Phone 3] ─┼──► [LiveKit Room] ◄──► [Python Agent]
[Player Laptop]  ─┤                              │
[Host Computer]  ─┘                              │
                                                  ▼
                                          [Your /api/host]
                                                  │
                                                  ▼
                                        [Baseten/JanitorAI]
```

- Everyone hears the Judge
- Only the speaking player's audio goes to the Judge
- Judge uses your existing AI setup (no extra costs!)

## Demo Tips

1. **Test beforehand** - Run through the flow once
2. **Have backup devices ready** - 2-3 phones minimum
3. **Explain the tech** - "Real-time voice with LiveKit + our custom AI"
4. **Show the code** - The agent code is surprisingly simple!
5. **Mention CalHacks** - Built specifically for this hackathon

Good luck! 🚀
