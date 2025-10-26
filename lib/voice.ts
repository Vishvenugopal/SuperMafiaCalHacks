let speaking = false
let lastTtsAt = 0
let lastTtsText = ''
let lastTtsTextAt = 0
const TTS_COOLDOWN_MS = 4000 // minimum gap between TTS requests
const TTS_DEDUPE_WINDOW_MS = 15000 // drop identical text within this window
const TTS_WINDOW_MS = 60_000
const TTS_MAX_PER_WINDOW = 8
let ttsTimes: number[] = []
let rec: any = null
let isListeningFlag = false
let lastPartial = ''
let lastFinal = ''
let endTimer: any = null
let onPartialCb: ((t: string) => void) | null = null
let onFinalCb: ((t: string) => void) | null = null

export async function ttsSpeak(text: string, personality?: 'default' | 'funny' | 'rap') {
  if (typeof window === 'undefined') return
  if (!text) return
  const now = Date.now()
  // Clean sliding window
  ttsTimes = ttsTimes.filter(t => now - t < TTS_WINDOW_MS)
  
  // Drop if currently speaking (avoid overlaps and dogpiles)
  if (speaking) {
    console.log('TTS: already speaking, dropping new request')
    return
  }
  
  // Drop repeated text within short window
  if (text === lastTtsText && (now - lastTtsTextAt) < TTS_DEDUPE_WINDOW_MS) {
    console.log('TTS: duplicate text within window, dropping')
    return
  }
  
  // Cooldown and rate limit
  if (now - lastTtsAt < TTS_COOLDOWN_MS) {
    console.log('TTS: cooldown active, dropping')
    return
  }
  if (ttsTimes.length >= TTS_MAX_PER_WINDOW) {
    console.log('TTS: per-minute rate limit reached, dropping')
    return
  }
  lastTtsAt = now
  lastTtsText = text
  lastTtsTextAt = now
  ttsTimes.push(now)
  
  // Respect global mute toggle (shared across modes)
  try {
    const muted = window.localStorage?.getItem('tts_disabled') === '1'
    if (muted) {
      console.log('TTS: muted via localStorage, skipping')
      return
    }
  } catch {}

  // Try to use a TTS API endpoint if available, unless temporarily disabled
  try {
    try {
      const disabledUntilStr = window.localStorage?.getItem('elevenlabs_disabled_until') || '0'
      const disabledUntil = parseInt(disabledUntilStr, 10) || 0
      if (Date.now() < disabledUntil) {
        throw new Error('elevenlabs temporarily disabled')
      }
    } catch {}

    const response = await fetch('/api/tts-elevenlabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, personality })
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
    } else {
      // Server fallback or error; back off future requests for a while
      try {
        const data = await response.json().catch(() => null as any)
        if (data?.fallback) {
          const backoffMs = 10 * 60 * 1000 // 10 minutes
          window.localStorage?.setItem('elevenlabs_disabled_until', String(Date.now() + backoffMs))
        }
      } catch {}
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
  return 'speechSynthesis' in window
}

export function isSttAvailable() {
  if (typeof window === 'undefined') return false
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return false
  }
  
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return result.state === 'granted'
  } catch (error) {
    console.warn('Could not check microphone permission:', error)
    return false
  }
}

/**
 * Check if microphone permission is granted
 */
export async function hasMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  
  try {
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      return result.state === 'granted'
    }
    // Fallback: try to access getUserMedia
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch (error) {
    console.warn('Microphone permission check failed:', error)
    return false
  }
}

export async function sttListenOnce(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  
  console.log('Starting STT listen...')
  // Web Speech API
  const w = window as any
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!SR) return null
  return await new Promise<string | null>(resolve => {
    const rec = new SR()
    rec.lang = 'en-US'
    rec.maxAlternatives = 1
    rec.interimResults = true
    let resolved = false
    let finalText = ''
    rec.onresult = (e: any) => {
      if (resolved) return
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) {
          finalText += res[0].transcript
        } else {
          // ignore interim for one-shot
        }
      }
    }
    rec.onerror = () => {
      if (resolved) return
      resolved = true
      rec.stop()
      resolve(finalText || null)
    }
    rec.onend = () => {
      if (resolved) return
      resolved = true
      resolve(finalText || null)
    }
    rec.start()
  })
}

export function startSttStream(
  onPartial?: (text: string) => void,
  onFinal?: (text: string | null) => void,
  opts?: { lang?: string; maxMs?: number }
) {
  if (typeof window === 'undefined') return false
  const w = window as any
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!SR) {
    console.error('Speech Recognition API not available in this browser')
    return false
  }

  // Stop any existing session first
  stopSttStream()

  onPartialCb = onPartial || null
  onFinalCb = onFinal || null
  lastPartial = ''
  lastFinal = ''

  rec = new SR()
  rec.lang = opts?.lang || 'en-US'
  rec.maxAlternatives = 1
  rec.interimResults = true
  ;(rec as any).continuous = true
  isListeningFlag = true

  const scheduleEndGuard = () => {
    if (endTimer) clearTimeout(endTimer)
    const maxMs = Math.max(4000, opts?.maxMs || 15000)
    endTimer = setTimeout(() => {
      // auto-stop if nothing for a while
      stopSttStream()
      const finalOrNull = ((lastFinal || lastPartial || '').trim()) || null
      ;(onFinalCb as any)?.(finalOrNull)
    }, maxMs)
  }

  rec.onstart = () => {
    scheduleEndGuard()
  }

  rec.onresult = (e: any) => {
    scheduleEndGuard()
    let interim = ''
    let anyFinal = false
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      if (res.isFinal) {
        lastFinal += res[0].transcript
        anyFinal = true
      } else {
        interim += res[0].transcript
      }
    }
    lastPartial = interim
    if (interim && onPartialCb) onPartialCb((lastFinal + interim).trim())
    if (anyFinal && onPartialCb) onPartialCb((lastFinal + interim).trim())
  }

  rec.onerror = (_e: any) => {
    // Stop on error but deliver what we have
    const text = (lastFinal || lastPartial || '').trim() || null
    stopSttStream()
    ;(onFinalCb as any)?.(text)
  }

  rec.onend = () => {
    if (!isListeningFlag) return
    // Chrome may end unexpectedly; try restarting to keep stream alive while holding
    try {
      rec && rec.start()
    } catch {}
  }

  try {
    rec.start()
    return true
  } catch {
    return false
  }
}

export function stopSttStream(deliverFinal: boolean = true) {
  isListeningFlag = false
  if (endTimer) {
    clearTimeout(endTimer)
    endTimer = null
  }
  try {
    rec && rec.stop()
  } catch {}
  const text = ((lastFinal || lastPartial || '').trim()) || null
  if (deliverFinal) {
    ;(onFinalCb as any)?.(text)
  }
  // reset state
  rec = null
  lastPartial = ''
  lastFinal = ''
  onPartialCb = null
  onFinalCb = null
}

export function isSttListening() {
  return isListeningFlag
}
