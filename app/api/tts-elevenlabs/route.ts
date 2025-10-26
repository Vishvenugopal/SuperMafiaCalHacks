import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const text: string = body?.text || ''
    
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    
    if (!apiKey) {
      console.log('ElevenLabs API key not configured, falling back to Web Speech API')
      return NextResponse.json({ 
        error: 'ElevenLabs not configured',
        fallback: true 
      }, { status: 200 })
    }

    // Use ElevenLabs TTS API
    // Voice ID: You can get this from https://elevenlabs.io/voice-library
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL' // Default: Sarah voice
    
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
