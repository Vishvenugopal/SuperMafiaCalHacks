let speaking = false
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
  
  // Try to use a TTS API endpoint if available
  try {
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
  if (!SR) return false

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
