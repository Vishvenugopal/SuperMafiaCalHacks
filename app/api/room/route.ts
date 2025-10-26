import { NextResponse } from 'next/server'

// In-memory room storage (in production, use Redis or a database)
interface Room {
  code: string
  hostId: string
  players: Array<{
    id: string
    name: string
    deviceId: string
    avatarDataUrl?: string
    joinedAt: number
  }>
  gamePhase: 'lobby' | 'playing'
  gameState: any
  nightActionsComplete: Set<string> // Track which players completed night actions
  rolesRevealed: Set<string> // Track which players revealed their role
  nightActions: Map<string, { role: string; action: string; targetId?: string }> // Store night actions from all players
  skipVotes: Set<string> // Track who voted to skip player discussion
  createdAt: number
  lastActivity: number
}

// Use global to persist across hot reloads in development
const globalForRooms = global as unknown as { rooms?: Map<string, Room> }
const rooms = globalForRooms.rooms ?? new Map<string, Room>()
if (!globalForRooms.rooms) {
  globalForRooms.rooms = rooms
  console.log('🏠 Room API initialized')
}

// Cleanup old rooms every 5 minutes
setInterval(() => {
  const now = Date.now()
  const timeout = 4 * 60 * 60 * 1000 // 4 hours
  
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > timeout) {
      rooms.delete(code)
      console.log(`Cleaned up inactive room: ${code}`)
    }
  }
}, 5 * 60 * 1000)

export async function POST(request: Request) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const { action, roomCode, playerName, deviceId, gameState, trackingType, avatarDataUrl } = body
    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action' }, { status: 400 })
    }
    
    switch (action) {
      case 'create': {
        // Create a new room
        const code = generateRoomCode()
        const playerId = `${deviceId}_${Date.now()}`
        
        const room: Room = {
          code,
          hostId: playerId,
          players: [{
            id: playerId,
            name: playerName,
            deviceId,
            avatarDataUrl,
            joinedAt: Date.now()
          }],
          gamePhase: 'lobby',
          gameState: null,
          nightActionsComplete: new Set(),
          rolesRevealed: new Set(),
          nightActions: new Map(),
          skipVotes: new Set(),
          createdAt: Date.now(),
          lastActivity: Date.now()
        }
        
        rooms.set(code, room)
        console.log(`Created room ${code} with host ${playerName}`)
        
        return NextResponse.json({
          success: true,
          roomCode: code,
          playerId,
          isHost: true,
          players: room.players
        })
      }
      
      case 'join': {
        // Join an existing room
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          console.log(`❌ Join failed: Room ${roomCode} not found. Active rooms: ${Array.from(rooms.keys()).join(', ')}`)
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        // Check if this device already joined
        const existing = room.players.find(p => p.deviceId === deviceId)
        if (existing) {
          room.lastActivity = Date.now()
          return NextResponse.json({
            success: true,
            roomCode: room.code,
            playerId: existing.id,
            isHost: existing.id === room.hostId,
            players: room.players
          })
        }
        
        // Add new player
        const playerId = `${deviceId}_${Date.now()}`
        room.players.push({
          id: playerId,
          name: playerName,
          deviceId,
          avatarDataUrl,
          joinedAt: Date.now()
        })
        
        room.lastActivity = Date.now()
        console.log(`✅ ${playerName} joined room ${roomCode} (${room.players.length} players total)`)
        
        return NextResponse.json({
          success: true,
          roomCode: room.code,
          playerId,
          isHost: false,
          players: room.players
        })
      }
      
      case 'get_state': {
        // Get current room state
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        room.lastActivity = Date.now()
        
        const hasGameState = !!room.gameState
        if (room.gamePhase === 'playing') {
          console.log(`📊 get_state for room ${roomCode}: phase=${room.gamePhase}, hasGameState=${hasGameState}`)
        }
        
        // Calculate alive players for skip votes (only count alive players)
        const alivePlayerIds = new Set<string>()
        if (room.gameState?.players) {
          room.gameState.players.forEach((p: any) => {
            if (p.alive) {
              alivePlayerIds.add(p.id)
            }
          })
        }
        
        // If no game state yet, count all players
        const totalAlivePlayers = alivePlayerIds.size > 0 ? alivePlayerIds.size : room.players.length
        
        return NextResponse.json({
          success: true,
          players: room.players,
          gameState: room.gameState,
          gamePhase: room.gamePhase,
          hostId: room.hostId,
          nightActionsComplete: room.nightActionsComplete.size,
          rolesRevealed: room.rolesRevealed.size,
          allNightActionsComplete: room.nightActionsComplete.size >= room.players.length,
          allRolesRevealed: room.rolesRevealed.size >= room.players.length,
          room: {
            skipVotes: room.skipVotes.size,
            allVotedSkip: room.skipVotes.size >= totalAlivePlayers,
            totalAlivePlayers
          }
        })
      }
      
      case 'start_game': {
        // Start the game (host only)
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        // Verify this is the host
        const player = room.players.find(p => p.deviceId === deviceId)
        if (!player || player.id !== room.hostId) {
          return NextResponse.json({
            success: false,
            error: 'Only host can start game'
          }, { status: 403 })
        }
        
        room.gamePhase = 'playing'
        room.lastActivity = Date.now()
        
        console.log(`Game started in room ${roomCode}`)
        
        return NextResponse.json({
          success: true
        })
      }
      
      case 'update_game_state': {
        // Update game state (host only)
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        // Verify this is the host
        const player = room.players.find(p => p.deviceId === deviceId)
        if (!player || player.id !== room.hostId) {
          return NextResponse.json({
            success: false,
            error: 'Only host can update game state'
          }, { status: 403 })
        }
        
        room.gameState = gameState
        // Ensure phase flag is consistent for clients
        room.gamePhase = 'playing'
        room.lastActivity = Date.now()
        
        console.log(`✅ Game state updated for room ${roomCode}`)
        console.log(`   Phase: ${gameState?.phase?.kind}, Players: ${gameState?.players?.length}, Seed: ${gameState?.seed}`)
        
        return NextResponse.json({
          success: true
        })
      }
      
      case 'mark_night_action_complete': {
        // Mark that a player completed their night action
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        room.nightActionsComplete.add(deviceId)
        room.lastActivity = Date.now()
        
        console.log(`Night action complete for ${deviceId} in room ${roomCode} (${room.nightActionsComplete.size}/${room.players.length})`)
        
        return NextResponse.json({
          success: true,
          completed: room.nightActionsComplete.size,
          total: room.players.length
        })
      }
      
      case 'mark_role_revealed': {
        // Mark that a player revealed their role
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        room.rolesRevealed.add(deviceId)
        room.lastActivity = Date.now()
        
        console.log(`Role revealed for ${deviceId} in room ${roomCode} (${room.rolesRevealed.size}/${room.players.length})`)
        
        return NextResponse.json({
          success: true,
          completed: room.rolesRevealed.size,
          total: room.players.length
        })
      }
      
      case 'reset_phase_tracking': {
        // Reset tracking (e.g., when entering a new night or role assignment)
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        if (trackingType === 'night') {
          room.nightActionsComplete.clear()
          room.nightActions.clear()
        } else if (trackingType === 'roles') {
          room.rolesRevealed.clear()
        } else if (trackingType === 'skip') {
          room.skipVotes.clear()
        }
        
        room.lastActivity = Date.now()
        
        console.log(`Reset ${trackingType} tracking for room ${roomCode}`)
        
        return NextResponse.json({
          success: true
        })
      }
      
      case 'submit_night_action': {
        // Submit a night action (kill, protect, peek)
        const room = rooms.get(roomCode?.toUpperCase())
        const { role, nightAction, targetId } = body
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        room.nightActions.set(deviceId, { role, action: nightAction, targetId })
        room.lastActivity = Date.now()
        
        console.log(`Night action submitted: ${deviceId} (${role}) - ${nightAction} ${targetId || 'none'}`)
        
        return NextResponse.json({
          success: true,
          actionsSubmitted: room.nightActions.size
        })
      }
      
      case 'get_night_actions': {
        // Get all submitted night actions (host only)
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        // Aggregate night actions by type
        let killTargetId: string | undefined
        let protectId: string | undefined
        let peekTargetId: string | undefined
        
        for (const [, action] of room.nightActions) {
          if (action.action === 'kill' && action.targetId) {
            killTargetId = action.targetId
          } else if (action.action === 'protect' && action.targetId) {
            protectId = action.targetId
          } else if (action.action === 'peek' && action.targetId) {
            peekTargetId = action.targetId
          }
        }
        
        console.log(`Aggregated night actions: kill=${killTargetId}, protect=${protectId}, peek=${peekTargetId}`)
        
        return NextResponse.json({
          success: true,
          nightActions: {
            killTargetId,
            protectId,
            peekTargetId
          }
        })
      }
      
      case 'vote_skip': {
        // Vote to skip player discussion phase
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({
            success: false,
            error: 'Room not found'
          }, { status: 404 })
        }
        
        room.skipVotes.add(deviceId)
        room.lastActivity = Date.now()
        
        // Calculate alive players for skip votes (only count alive players)
        const alivePlayerIds = new Set<string>()
        if (room.gameState?.players) {
          room.gameState.players.forEach((p: any) => {
            if (p.alive) {
              alivePlayerIds.add(p.id)
            }
          })
        }
        
        // If no game state yet, count all players
        const totalAlivePlayers = alivePlayerIds.size > 0 ? alivePlayerIds.size : room.players.length
        
        console.log(`Skip vote added: ${deviceId} (${room.skipVotes.size}/${totalAlivePlayers})`)
        
        return NextResponse.json({
          success: true,
          skipVotes: room.skipVotes.size,
          total: totalAlivePlayers,
          allVotedSkip: room.skipVotes.size >= totalAlivePlayers,
          gameState: room.gameState // Include game state for immediate sync
        })
      }
      
      case 'leave': {
        // Leave room
        const room = rooms.get(roomCode?.toUpperCase())
        
        if (!room) {
          return NextResponse.json({ success: true })
        }
        
        const leavingPlayer = room.players.find(p => p.deviceId === deviceId)
        const wasHost = leavingPlayer?.id === room.hostId
        
        room.players = room.players.filter(p => p.deviceId !== deviceId)
        room.lastActivity = Date.now()
        
        // If no players left, delete room
        if (room.players.length === 0) {
          rooms.delete(roomCode!.toUpperCase())
          console.log(`Room ${roomCode} deleted (empty)`)
        } else {
          // If host left, transfer to next player
          if (wasHost && room.players.length > 0) {
            room.hostId = room.players[0].id
            console.log(`Host left room ${roomCode}, transferred to ${room.players[0].name}`)
          } else {
            console.log(`Player left room ${roomCode}, ${room.players.length} remaining`)
          }
        }
        
        return NextResponse.json({ success: true })
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Room API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  // Get room info for debugging
  const url = new URL(request.url)
  const roomCode = url.searchParams.get('code')
  
  if (!roomCode) {
    return NextResponse.json({
      totalRooms: rooms.size,
      rooms: Array.from(rooms.values()).map(r => ({
        code: r.code,
        players: r.players.length,
        createdAt: new Date(r.createdAt).toISOString()
      }))
    })
  }
  
  const room = rooms.get(roomCode.toUpperCase())
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }
  
  return NextResponse.json({
    code: room.code,
    players: room.players,
    hasGameState: !!room.gameState
  })
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  
  // Keep trying until we find an unused code
  do {
    code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  } while (rooms.has(code))
  
  return code
}
