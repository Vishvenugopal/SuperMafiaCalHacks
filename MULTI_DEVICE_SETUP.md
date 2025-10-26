# Multi-Device AI Judge Mode Setup

## Overview
This new game mode allows multiple players to join from different devices and take turns talking to an AI Judge that decides who to eliminate. Perfect for your CalHacks demo!

## Architecture
- **Frontend (Next.js)**: Room creation/joining UI with push-to-talk
- **LiveKit**: Real-time voice communication infrastructure
- **Python Agent**: AI Judge that listens and responds using OpenAI GPT-4

## Setup Instructions

### 1. LiveKit Setup
You need a LiveKit server. Two options:

**Option A: LiveKit Cloud (Recommended for demo)**
1. Go to https://cloud.livekit.io/
2. Create a free account
3. Create a new project
4. Copy your credentials:
   - WebSocket URL
   - API Key
   - API Secret

**Option B: Self-hosted**
```bash
docker run -d --name livekit \
  -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server \
  --dev
```

### 2. Environment Variables
Create/update your `.env.local` file:

```env
# LiveKit Configuration
NEXT_PUBLIC_LIVEKIT_WS_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=secret-key-here

# No additional AI keys needed!
# The agent uses your existing Baseten/JanitorAI setup via your /api/host endpoint
```

### 3. Install Python Agent Dependencies

```bash
pip install -r agent/requirements.txt
```

That's it! Only 3 simple packages needed.

### 4. Start the Services

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - AI Agent:**
```bash
python agent/simple_judge.py
```

Enter the room code when prompted (e.g., `ABC123`). The agent will join that room.

## How to Play

### For the Host:
1. Go to http://localhost:3000
2. Click "AI Judge" mode
3. Enter your name
4. Click "Create New Room"
5. Share the 6-character room code with other players
6. Wait for the AI Judge to connect (check the status indicator)
7. Once everyone is in and the judge is connected, click "Start Game"

### For Players Joining:
1. Go to http://localhost:3000 on their own device
2. Click "AI Judge" mode
3. Enter their name
4. Enter the room code
5. Click "Join Room"

### During the Game:
- **Push-to-Talk**: Hold the microphone button to talk to the AI Judge
- The Judge will respond after you release the button
- Only one person can talk at a time (enforced by the UI)
- The Judge will ask questions and eventually decide who to eliminate

## Game Flow

1. **Lobby Phase**
   - Players join with room code
   - Host waits for AI Judge to connect
   - Host starts game when ready

2. **Discussion Phase**
   - Players take turns talking to the Judge
   - Press and hold to talk, release to submit
   - Judge responds to each player
   - Judge can ask clarifying questions

3. **Voting Phase**
   - Judge decides who to eliminate based on arguments
   - Judge explains reasoning
   - Eliminated player is removed

4. **Repeat**
   - Continue until game end condition

## Troubleshooting

### Agent won't connect
- Check `.env.local` has correct LiveKit credentials
- Make sure agent script is running: `python judge_agent.py start`
- Check agent logs for connection errors
- Verify room names match format: `mafia-XXXXXX`

### No audio from Judge
- Check API keys for OpenAI/Cartesia/Deepgram
- Look at agent console logs for TTS errors
- Try using OpenAI TTS as fallback (it's more reliable)

### Players can't hear each other
- This is expected! Players only talk to the Judge
- If you want player-to-player audio, enable it in LiveKit settings

### Push-to-talk not working
- Check browser microphone permissions
- Look at browser console for errors
- Ensure LiveKit connection is established (green indicator)

## Architecture Details

### Room Management
- Room codes are 6-character alphanumeric (e.g., `ABC123`)
- Internally stored as `mafia-ABC123` in LiveKit
- Each room is isolated - players can't hear other rooms

### Push-to-Talk Flow
1. Player presses button → Frontend calls `startAgentTurn()`
2. Frontend sends RPC `start_turn` to agent
3. Agent enables audio input for that player
4. Player speaks (audio streams to agent)
5. Player releases button → Frontend calls `endAgentTurn()`
6. Frontend sends RPC `end_turn` to agent
7. Agent commits the turn and generates response
8. Agent speaks response (all players hear it)

### Data Broadcasting
- Game state is broadcast to all participants via LiveKit data channels
- Used for: who's speaking, game phase, etc.
- Ensures all devices stay in sync

## Next Steps

### Improvements You Can Make:
1. **Add game logic**: Track roles, votes, eliminations
2. **Voting system**: Let the Judge actually eliminate players
3. **Timer**: Add time limits for speaking
4. **Chat**: Add text chat alongside voice
5. **Spectator mode**: Let eliminated players watch
6. **Better UI**: Show who's alive/dead, voting results, etc.

### Integration with Existing Werewolf Mode:
- The single-device Werewolf mode (`/werewolf`) still works
- This is a completely separate game mode
- You can reuse game logic from Werewolf if you want

## Demo Tips for CalHacks

1. **Prepare a backup**: Have a recorded demo video in case of network issues
2. **Test beforehand**: Make sure all API keys work
3. **Use LiveKit Cloud**: More reliable than self-hosted for demos
4. **Have 2-3 devices ready**: Your phone, friend's phone, laptop
5. **Explain the tech**: Mention LiveKit, GPT-4, real-time voice
6. **Show the code**: The Python agent code is impressive

## Questions?

Check the LiveKit docs: https://docs.livekit.io/
Or the example this is based on: https://github.com/livekit/agents/blob/main/examples/voice_agents/push_to_talk.py

Good luck at CalHacks! 🚀
