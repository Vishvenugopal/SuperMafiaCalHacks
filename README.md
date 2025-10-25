# SuperMafia - AI-Hosted Werewolf Game

Mobile-first, pass-the-phone Werewolf game with AI host personality and realtime voice.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Keys

Copy `.env.local.example` to `.env.local` and fill in your API keys:

#### LiveKit (for realtime voice)
1. Go to https://cloud.livekit.io
2. Create a free account
3. Create a new project
4. Copy your credentials:
   - **WebSocket URL**: `wss://your-project.livekit.cloud`
   - **API Key**: Found in project settings
   - **API Secret**: Found in project settings

Add to `.env.local`:
```env
LIVEKIT_WS_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

#### JanitorAI (for host personality)
1. Go to https://janitorai.com
2. Create an account
3. Get your API key from settings
4. Create or find a character for your host
5. Copy the character ID from the URL

Add to `.env.local`:
```env
JANITOR_AI_API_KEY=your_janitor_api_key
JANITOR_AI_CHARACTER_ID=your_character_id
```

**Note**: The app works without these keys using Web Speech API and a mock host. LiveKit and JanitorAI are optional enhancements.

### 3. Run Development Server
```bash
npm run dev
```

Open http://localhost:3000

## Features

- **Pass-the-phone gameplay**: One device for the whole table
- **AI Host**: Narrates game events and answers questions
- **Voice interaction**: Push-to-talk to ask the host questions
- **Roles**: Villager, Werewolf, Seer, Medic
- **Mobile-optimized**: Designed for handheld play
- **Privacy**: Role reveals are private, night actions are hidden

## How to Play

1. Add 5+ players with names and photos
2. Configure roles (optional)
3. Choose theme and host personality
4. Start game
5. Pass phone for role reveals (in order players were added)
6. **Night Phase**: Pass to each special role in order
   - Medic protects someone (if they're killed, protection saves them)
   - Werewolves choose a target
   - Seer peeks at someone's role
7. **Day Phase**: Discuss and vote to eliminate suspects
8. Win when all werewolves are eliminated (villagers) or werewolves equal villagers (werewolves)

### Role Abilities
- **Medic**: Protect one player each night (werewolves can still target them, but protection saves them)
- **Werewolf**: Choose one player to eliminate each night
- **Seer**: Peek at one player's role each night
- **Villager**: No special ability, but crucial for voting

## Tech Stack

- **Next.js 14** + React 18
- **TypeScript** (strict mode)
- **TailwindCSS** for styling
- **Zustand** for state management
- **LiveKit** for realtime voice (optional)
- **JanitorAI** for AI host personality (optional)
- **Web Speech API** for fallback STT/TTS

## Architecture

- **Client-side first**: Game state managed in browser
- **Offline-capable**: Works without internet (using Web Speech API)
- **Progressive enhancement**: LiveKit and JanitorAI add features when configured
- **Type-safe**: Full TypeScript coverage with strict mode

## API Integration

### LiveKit
- Automatically used when `LIVEKIT_WS_URL` is configured
- Falls back to Web Speech API if unavailable
- Provides lower latency and better quality voice

### JanitorAI
- Automatically used when `JANITOR_AI_API_KEY` is configured
- Falls back to mock host if unavailable
- Provides personality-driven responses

Both integrations work together seamlessly - LiveKit handles voice, JanitorAI handles personality.

## License

MIT
