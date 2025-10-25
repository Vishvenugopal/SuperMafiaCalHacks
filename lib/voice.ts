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
  
  // Try LiveKit first if configured
  if (await ensureLiveKit()) {
    const success = await speakWithLiveKit(text)
    if (success) return
  }
  
  // Fallback to Web Speech API
  if (!('speechSynthesis' in window)) return
  await new Promise<void>(resolve => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    u.pitch = 1
    u.onend = () => {
      speaking = false
      resolve()
    }
    u.onerror = () => {
      speaking = false
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
  
  // Try LiveKit first if configured
  if (await ensureLiveKit()) {
    return new Promise<string | null>((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          stopLiveKitSTT()
          resolve(null)
        }
      }, 10000) // 10 second timeout
      
      startLiveKitSTT((text) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          stopLiveKitSTT()
          resolve(text)
        }
      })
    })
  }
  
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
