import { initLiveKit, startLiveKitSTT, stopLiveKitSTT, speakWithLiveKit } from './livekit'

let speaking = false
let livekitInitialized = false
let useLiveKit = false

async function ensureLiveKit() {
  if (livekitInitialized) return useLiveKit
  
  const room = await initLiveKit()
  livekitInitialized = true
  useLiveKit = !!room
  return useLiveKit
}

export async function ttsSpeak(text: string) {
  if (typeof window === 'undefined') return
  if (!text) return
  
  // Try to use a TTS API endpoint if available
  try {
    const response = await fetch('/api/tts-elevenlabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    
    if (response.ok && response.headers.get('content-type')?.includes('audio')) {
      console.log('Using ElevenLabs TTS')
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          speaking = false
          console.log('Speech ended')
          resolve()
        }
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          speaking = false
          resolve()
        }
        speaking = true
        audio.play()
      })
      return
    }
  } catch (error) {
    console.log('TTS API not available, using Web Speech API fallback')
  }
  
  // Fallback to Web Speech API
  if (!('speechSynthesis' in window)) {
    console.warn('No speech synthesis available')
    return
  }
  
  console.log('Using Web Speech API for TTS:', text.substring(0, 50))
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel()
  
  await new Promise<void>(resolve => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    u.pitch = 1
    u.volume = 1
    u.onend = () => {
      speaking = false
      console.log('Speech ended')
      resolve()
    }
    u.onerror = (e) => {
      speaking = false
      console.error('Speech error:', e)
      resolve()
    }
    speaking = true
    window.speechSynthesis.speak(u)
  })
}

export function isTtsAvailable() {
  if (typeof window === 'undefined') return false
  return 'speechSynthesis' in window || useLiveKit
}

export function isSttAvailable() {
  if (typeof window === 'undefined') return false
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition) || useLiveKit
}

export async function sttListenOnce(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  
  console.log('Starting STT listen...')
  
  // Try LiveKit first if configured
  if (await ensureLiveKit()) {
    console.log('Using LiveKit for STT')
    return new Promise<string | null>((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          console.log('STT timeout - no speech detected')
          resolved = true
          stopLiveKitSTT()
          resolve(null)
        }
      }, 10000) // 10 second timeout
      
      startLiveKitSTT((text) => {
        if (!resolved) {
          console.log('STT received:', text)
          resolved = true
          clearTimeout(timeout)
          stopLiveKitSTT()
          resolve(text)
        }
      })
    })
  }
  
  console.log('LiveKit not available, using Web Speech API')
  
  // Fallback to Web Speech API
  const w = window as any
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!SR) return null
  return await new Promise<string | null>(resolve => {
    const rec = new SR()
    rec.lang = 'en-US'
    rec.maxAlternatives = 1
    rec.interimResults = false
    let resolved = false
    rec.onresult = (e: any) => {
      if (resolved) return
      const t = e.results?.[0]?.[0]?.transcript || ''
      resolved = true
      rec.stop()
      resolve(t)
    }
    rec.onerror = () => {
      if (resolved) return
      resolved = true
      rec.stop()
      resolve(null)
    }
    rec.onend = () => {
      if (resolved) return
      resolved = true
      resolve(null)
    }
    rec.start()
  })
}
