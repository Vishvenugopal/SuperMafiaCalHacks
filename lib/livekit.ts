"use client"

let room: any = null
let audioTrack: any = null

export async function initLiveKit() {
  if (typeof window === 'undefined') return null
  
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL
  if (!wsUrl) {
    console.warn('LiveKit not configured (NEXT_PUBLIC_LIVEKIT_WS_URL missing), using Web Speech API')
    return null
  }

  console.log('Initializing LiveKit with URL:', wsUrl)

  try {
    // Get token from API
    console.log('Fetching LiveKit token...')
    const response = await fetch('/api/livekit-token', { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok || !data.token) {
      console.error('Failed to get LiveKit token:', data)
      return null
    }
    
    console.log('LiveKit token received')
    
    // Dynamically import LiveKit SDK
    const { Room, RoomEvent } = await import('livekit-client')
    
    room = new Room()
    console.log('Connecting to LiveKit room...')
    await room.connect(wsUrl, data.token)
    
    console.log('✅ LiveKit connected successfully!')
    return room
  } catch (error) {
    console.error('❌ LiveKit init failed:', error)
    return null
  }
}

export async function startLiveKitSTT(onTranscript: (text: string) => void) {
  if (!room) return null
  
  try {
    // Enable microphone through LiveKit
    await room.localParticipant.setMicrophoneEnabled(true)
    
    // Use Web Speech API for transcription
    // (LiveKit handles the audio capture)
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) {
      console.error('Speech recognition not available')
      return null
    }
    
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      console.log('LiveKit STT result:', transcript)
      onTranscript(transcript)
    }
    
    recognition.onerror = (event: any) => {
      console.error('LiveKit STT error:', event.error)
    }
    
    recognition.start()
    audioTrack = recognition
    
    return recognition
  } catch (error) {
    console.error('LiveKit STT failed:', error)
    return null
  }
}

export async function stopLiveKitSTT() {
  // Stop speech recognition
  if (audioTrack && typeof audioTrack.stop === 'function') {
    try {
      audioTrack.stop()
    } catch (error) {
      console.error('Failed to stop recognition:', error)
    }
  }
  
  // Disable microphone through LiveKit
  if (room) {
    try {
      await room.localParticipant.setMicrophoneEnabled(false)
    } catch (error) {
      console.error('Failed to stop microphone:', error)
    }
  }
  
  audioTrack = null
}

export async function speakWithLiveKit(text: string) {
  if (!room) return false
  
  try {
    // Send TTS request through LiveKit data channel
    await room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: 'tts', text })),
      { reliable: true }
    )
    return true
  } catch (error) {
    console.error('LiveKit TTS failed:', error)
    return false
  }
}

export function disconnectLiveKit() {
  if (room) {
    room.disconnect()
    room = null
  }
  audioTrack = null
}
