# API Keys Setup Guide

## What You Need

Your `.env.local` file needs these keys for full functionality:

### 1. LiveKit (Realtime Voice)
**What it does**: Provides low-latency, high-quality voice communication for the game.

**How to get it**:
1. Visit https://cloud.livekit.io
2. Sign up for a free account
3. Click "Create Project"
4. Name your project (e.g., "SuperMafia")
5. Once created, go to "Settings" → "Keys"
6. Copy these values:
   - **WebSocket URL**: `wss://your-project-name.livekit.cloud`
   - **API Key**: Starts with `API...`
   - **API Secret**: Long string shown once

**Add to .env.local**:
```env
LIVEKIT_WS_URL=wss://your-project-name.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=your_secret_here
```

### 2. Baseten (AI Narrator/Host - Recommended)
**What it does**: Powers a game-aware AI narrator that knows the current game state and provides immersive, context-aware commentary.

**How to get it**:
1. Visit https://baseten.co
2. Sign up for an account
3. Get your API key from account settings
4. Choose a model from their library (e.g., `zai-org/GLM-4.6`, `meta-llama/Llama-3.1-8B-Instruct`, etc.)

**Add to .env.local**:
```env
BASETEN_API_KEY=your_api_key_here
BASETEN_MODEL_ID=zai-org/GLM-4.6
```

**Note**: Use the full model name (e.g., `zai-org/GLM-4.6`) not a deployment ID. The app uses Baseten's OpenAI-compatible inference endpoint.

### 3. JanitorAI (AI Host Personality - Alternative)
**What it does**: Powers the AI host with personality and context-aware responses.

**How to get it**:
1. Visit https://janitorai.com
2. Create an account
3. Go to your profile → Settings → API
4. Generate an API key
5. Browse or create a character for your game host
6. Open the character page and copy the ID from the URL
   - Example URL: `https://janitorai.com/characters/abc123def456`
   - Character ID: `abc123def456`

**Add to .env.local**:
```env
JANITOR_AI_API_KEY=your_api_key_here
JANITOR_AI_CHARACTER_ID=abc123def456
```

## How They Work Together

- **LiveKit** handles voice input (STT - Speech to Text)
- **Baseten** provides game-aware AI narrator (knows current phase, players, events)
- **ElevenLabs** provides high-quality voice output (TTS)
- When you ask the host a question:
  1. Your voice is captured and converted to text (LiveKit or Web Speech API)
  2. Question + current game state is sent to Baseten → gets context-aware response
  3. Response is synthesized using ElevenLabs → spoken aloud with natural voice

## AI Priority Order

The app tries AI services in this order:
1. **Baseten** (best - game-aware, knows what's happening)
2. **JanitorAI** (good - personality-driven but less game-aware)
3. **Mock Host** (fallback - basic scripted responses)

## Fallback Behavior

**Without LiveKit**: Uses browser's Web Speech API (works but lower quality)
**Without JanitorAI**: Uses mock host with basic rule responses

The app works without any API keys, but the experience is much better with them!

## Testing Your Setup

1. Fill in your `.env.local` file
2. Restart the dev server: `npm run dev`
3. Open the app and start a game
4. During Discussion phase, click "Hold to ask host"
5. Ask: "What are the rules?"
6. You should hear a personality-driven response if JanitorAI is working
7. Voice quality should be crisp if LiveKit is working

## Troubleshooting

### LiveKit not connecting
- Check that `LIVEKIT_WS_URL` starts with `wss://`
- Verify API key and secret are correct
- Check browser console for errors

### JanitorAI not responding
- Verify API key is valid
- Check that character ID exists
- Look at server logs (terminal) for error messages

### Voice not working
- Grant microphone permissions in browser
- Check that you're using HTTPS or localhost
- Try in Chrome/Edge (best Web Speech API support)

## Cost

- **LiveKit**: Free tier includes 50 GB/month (plenty for testing)
- **JanitorAI**: Check their pricing page for current rates

## Security Notes

- Never commit `.env.local` to git (it's in `.gitignore`)
- Keep your API keys private
- Regenerate keys if accidentally exposed
