import { NextResponse } from 'next/server'
import { getElevenLabsVoiceId } from '@/lib/voices'
import { getEnv } from '@/lib/env-validation'

// Simple in-memory throttles (per process)
let lastAt = 0
let lastText = ''
let lastTextAt = 0
const COOLDOWN_MS = 3000
const DEDUPE_WINDOW_MS = 15000
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 12
let times: number[] = []

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const text: string = body?.text || ''
    const personality: 'default' | 'funny' | 'rap' | undefined = body?.personality
    
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const apiKey = getEnv('ELEVENLABS_API_KEY')
    
    if (!apiKey) {
      console.log('ElevenLabs API key not configured, falling back to Web Speech API')
      return NextResponse.json({ 
        error: 'ElevenLabs not configured',
        fallback: true 
      }, { status: 200 })
    }

    // Global throttles
    const now = Date.now()
    times = times.filter(t => now - t < WINDOW_MS)
    if (now - lastAt < COOLDOWN_MS) {
      return NextResponse.json({ error: 'cooldown', fallback: true }, { status: 200 })
    }
    if (text === lastText && (now - lastTextAt) < DEDUPE_WINDOW_MS) {
      return NextResponse.json({ error: 'dedupe', fallback: true }, { status: 200 })
    }
    if (times.length >= MAX_PER_WINDOW) {
      return NextResponse.json({ error: 'rate_limited', fallback: true }, { status: 200 })
    }
    lastAt = now
    lastText = text
    lastTextAt = now
    times.push(now)

    // Use ElevenLabs TTS API
    // Voice ID: You can get this from https://elevenlabs.io/voice-library
    const voiceId = getElevenLabsVoiceId(personality || 'default')
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    })

    if (!response.ok) {
      console.error(`ElevenLabs TTS error: ${response.status}`)
      return NextResponse.json({ 
        error: 'TTS API error',
        fallback: true 
      }, { status: 200 })
    }

    // Return audio data
    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString()
      }
    })
  } catch (e) {
    console.error('TTS API error:', e)
    return NextResponse.json({ 
      error: 'Internal error',
      fallback: true 
    }, { status: 200 })
  }
}
