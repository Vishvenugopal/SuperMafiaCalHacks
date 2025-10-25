"use client"

let room: any = null
let audioTrack: any = null

export async function initLiveKit() {
  if (typeof window === 'undefined') return null
  
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL
  if (!wsUrl) {
    console.warn('LiveKit not configured, using Web Speech API')
    return null
  }

  try {
    // Get token from API
    const response = await fetch('/api/livekit-token', { method: 'POST' })
    const { token } = await response.json()
    
    // Dynamically import LiveKit SDK
    const { Room, RoomEvent } = await import('livekit-client')
    
    room = new Room()
    await room.connect(wsUrl, token)
    
    return room
  } catch (error) {
    console.error('LiveKit init failed:', error)
    return null
  }
}

export async function startLiveKitSTT(onTranscript: (text: string) => void) {
  if (!room) return null
  
  try {
    const localTrack = await room.localParticipant.setMicrophoneEnabled(true)
    audioTrack = localTrack
    
    // Subscribe to transcription events if available
    room.on('transcriptionReceived', (data: any) => {
      if (data.text) onTranscript(data.text)
    })
    
    return audioTrack
  } catch (error) {
    console.error('LiveKit STT failed:', error)
    return null
  }
}

export async function stopLiveKitSTT() {
  if (audioTrack) {
    audioTrack.stop()
    audioTrack = null
  }
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
