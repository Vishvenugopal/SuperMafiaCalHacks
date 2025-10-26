"use client"

import type { Room, RemoteParticipant, RoomEvent } from 'livekit-client'

let currentRoom: Room | null = null

// Generate a 6-character room code
export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Connect to a LiveKit room with a room code
export async function connectToRoom(
  roomCode: string,
  playerName: string,
  onParticipantJoined?: (participant: RemoteParticipant) => void,
  onParticipantLeft?: (participant: RemoteParticipant) => void,
  onDataReceived?: (data: any, participant?: RemoteParticipant) => void
): Promise<Room | null> {
  if (typeof window === 'undefined') return null

  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL
  if (!wsUrl) {
    console.warn('LiveKit not configured (NEXT_PUBLIC_LIVEKIT_WS_URL missing)')
    return null
  }

  try {
    // Get token from API with room code
    console.log(`Connecting to room: ${roomCode} as ${playerName}`)
    const response = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: `mafia-${roomCode}`,
        playerName,
      }),
    })

    const data = await response.json()
    if (!response.ok || !data.token) {
      console.error('Failed to get LiveKit token:', data)
      return null
    }

    // Dynamically import LiveKit SDK
    const { Room, RoomEvent } = await import('livekit-client')

    // Disconnect existing room if any
    if (currentRoom) {
      currentRoom.disconnect()
    }

    currentRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    // Set up event listeners
    if (onParticipantJoined) {
      currentRoom.on(RoomEvent.ParticipantConnected, onParticipantJoined)
    }
    if (onParticipantLeft) {
      currentRoom.on(RoomEvent.ParticipantDisconnected, onParticipantLeft)
    }
    if (onDataReceived) {
      currentRoom.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        const decoder = new TextDecoder()
        const strData = decoder.decode(payload)
        try {
          const jsonData = JSON.parse(strData)
          onDataReceived(jsonData, participant)
        } catch {
          onDataReceived({ raw: strData }, participant)
        }
      })
    }

    await currentRoom.connect(wsUrl, data.token)
    console.log('✅ Connected to room:', roomCode)
    
    return currentRoom
  } catch (error) {
    console.error('❌ Room connection failed:', error)
    return null
  }
}

// Send push-to-talk RPC to agent to start listening
export async function startAgentTurn(room: Room): Promise<boolean> {
  if (!room || !room.localParticipant) return false

  try {
    // Find the agent participant
    const agent = Array.from(room.remoteParticipants.values()).find(
      (p) => p.identity === 'ptt-agent' || p.attributes?.['push-to-talk'] === '1'
    )

    if (!agent) {
      console.error('No push-to-talk agent found in room')
      return false
    }

    console.log('📢 Starting agent turn...')
    await room.localParticipant.performRpc({
      destinationIdentity: agent.identity,
      method: 'start_turn',
      payload: '',
    })

    return true
  } catch (error) {
    console.error('Failed to start agent turn:', error)
    return false
  }
}

// Send push-to-talk RPC to agent to stop listening and respond
export async function endAgentTurn(room: Room): Promise<boolean> {
  if (!room || !room.localParticipant) return false

  try {
    const agent = Array.from(room.remoteParticipants.values()).find(
      (p) => p.identity === 'ptt-agent' || p.attributes?.['push-to-talk'] === '1'
    )

    if (!agent) {
      console.error('No push-to-talk agent found in room')
      return false
    }

    console.log('🛑 Ending agent turn...')
    await room.localParticipant.performRpc({
      destinationIdentity: agent.identity,
      method: 'end_turn',
      payload: '',
    })

    return true
  } catch (error) {
    console.error('Failed to end agent turn:', error)
    return false
  }
}

// Cancel agent turn without response
export async function cancelAgentTurn(room: Room): Promise<boolean> {
  if (!room || !room.localParticipant) return false

  try {
    const agent = Array.from(room.remoteParticipants.values()).find(
      (p) => p.identity === 'ptt-agent' || p.attributes?.['push-to-talk'] === '1'
    )

    if (!agent) return false

    console.log('❌ Canceling agent turn...')
    await room.localParticipant.performRpc({
      destinationIdentity: agent.identity,
      method: 'cancel_turn',
      payload: '',
    })

    return true
  } catch (error) {
    console.error('Failed to cancel agent turn:', error)
    return false
  }
}

// Broadcast data to all participants
export async function broadcastData(room: Room, data: any): Promise<boolean> {
  if (!room || !room.localParticipant) return false

  try {
    const encoder = new TextEncoder()
    const payload = encoder.encode(JSON.stringify(data))
    await room.localParticipant.publishData(payload, { reliable: true })
    return true
  } catch (error) {
    console.error('Failed to broadcast data:', error)
    return false
  }
}

// Get current room
export function getCurrentRoom(): Room | null {
  return currentRoom
}

// Disconnect from room
export function disconnectRoom() {
  if (currentRoom) {
    currentRoom.disconnect()
    currentRoom = null
  }
}

// Get all participants (excluding self and agent)
export function getPlayers(room: Room): RemoteParticipant[] {
  return Array.from(room.remoteParticipants.values()).filter(
    (p) => p.identity !== 'ptt-agent' && !p.attributes?.['push-to-talk']
  )
}

// Check if agent is in room
export function hasAgent(room: Room): boolean {
  return Array.from(room.remoteParticipants.values()).some(
    (p) => p.identity === 'ptt-agent' || p.attributes?.['push-to-talk'] === '1'
  )
}
