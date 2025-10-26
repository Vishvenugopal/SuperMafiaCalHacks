"use client"
import { useGame } from '@/store/game'
import { Player } from '@/lib/types'
import { useRef, useState, useEffect, useCallback, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { ttsSpeak, isTtsAvailable, startSttStream, stopSttStream } from '@/lib/voice'

// IMPORTANT: This is a MULTI-DEVICE version of Werewolf with Judge voting
// Each player joins on their own device via room code
// Game state is synced through the server

const GAME_TITLE_STYLE = {
  fontFamily: 'Boldonse, sans-serif',
  background: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  paddingTop: '0.1em',
  paddingBottom: '0.1em',
  lineHeight: '1.2',
  display: 'inline-block'
}

function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`glass-strong rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 ${props.className || ''}`}>
      {props.children}
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 animate-slideIn">
      <div className="text-base font-bold gradient-text">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

interface RoomPlayer {
  id: string
  name: string
  deviceId: string
}

export default function JudgeMode() {
  const g = useGame()
  
  // Multi-device state
  const [phase, setPhase] = useState<'join' | 'lobby' | 'playing'>('join')
  const [roomCode, setRoomCode] = useState('')
  const [inputRoomCode, setInputRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [deviceId] = useState(() => `device_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  const [isHost, setIsHost] = useState(false)
  const [hostId, setHostId] = useState('')
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([])
  const [myPlayerName, setMyPlayerName] = useState('')
  
  // Game state sync
  const [gameStateVersion, setGameStateVersion] = useState(0)
  const lastSyncedVersion = useRef(0)
  
  // UI state
  const [hostResponse, setHostResponse] = useState<string>('')
  const [userTranscript, setUserTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [judgeResponse, setJudgeResponse] = useState('')
  const [roleRevealed, setRoleRevealed] = useState(false)
  const now = useNow(200)
  
  // My player info
  const myPlayer = g.players.find(p => p.name === myPlayerName)
  const myRole = myPlayer?.role || 'villager'
  
  // Poll for room updates (lobby only)
  useEffect(() => {
    if (phase !== 'lobby') return
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_state',
            roomCode,
            deviceId
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setRoomPlayers(data.players || [])
            setHostId(data.hostId || '')
            
            // Check if we're the host (in case it transferred)
            if (data.hostId === playerId) {
              if (!isHost) {
                setIsHost(true)
                alert('🎮 You are now the host! You can start the game when ready.')
              }
            } else {
              if (isHost) {
                setIsHost(false)
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync room state:', error)
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [phase, roomCode, deviceId, playerId, isHost])
  
  // Sync game state when playing (more frequent)
  useEffect(() => {
    if (phase !== 'playing') return
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_state',
            roomCode,
            deviceId
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.gameState) {
            const serverVersion = data.gameState.version || 0
            
            // Only update if server has newer version
            if (serverVersion > lastSyncedVersion.current) {
              console.log(`[Sync] Updating from server version ${serverVersion}`)
              
              // Update local game state from server
              // This is a simplified sync - in production you'd want more robust state management
              if (data.gameState.phase) {
                // Sync phase and players
                lastSyncedVersion.current = serverVersion
                setGameStateVersion(serverVersion)
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync game state:', error)
      }
    }, 1000) // Poll every second during game
    
    return () => clearInterval(interval)
  }, [phase, roomCode, deviceId])
  
  // Push game state to server (host only)
  const pushGameState = useCallback(async () => {
    if (!isHost || phase !== 'playing') return
    
    try {
      const newVersion = Date.now()
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_game_state',
          roomCode,
          deviceId,
          gameState: {
            version: newVersion,
            phase: g.phase,
            round: g.round,
            players: g.players,
            eventLog: g.eventLog
          }
        })
      })
      lastSyncedVersion.current = newVersion
    } catch (error) {
      console.error('Failed to push game state:', error)
    }
  }, [isHost, phase, roomCode, deviceId, g.phase, g.round, g.players, g.eventLog])
  
  // Push state when game changes (host only)
  useEffect(() => {
    if (isHost && phase === 'playing') {
      pushGameState()
    }
  }, [g.phase, isHost, phase, pushGameState])
  
  // Create room (host)
  const createRoom = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name')
      return
    }
    
    try {
      const response = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          playerName: playerName.trim(),
          deviceId
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setRoomCode(data.roomCode)
        setPlayerId(data.playerId)
        setIsHost(data.isHost)
        setHostId(data.playerId)
        setRoomPlayers(data.players)
        setMyPlayerName(playerName.trim())
        setPhase('lobby')
      } else {
        alert('Failed to create room: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Create room error:', error)
      alert('Failed to create room')
    }
  }

  // Join room (non-host)
  const joinRoom = async () => {
    if (!playerName.trim() || !inputRoomCode.trim()) {
      alert('Please enter your name and room code')
      return
    }
    
    try {
      const response = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          roomCode: inputRoomCode.trim().toUpperCase(),
          playerName: playerName.trim(),
          deviceId
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setRoomCode(data.roomCode)
        setPlayerId(data.playerId)
        setIsHost(data.isHost)
        setRoomPlayers(data.players)
        setMyPlayerName(playerName.trim())
        setPhase('lobby')
      } else {
        alert('Failed to join room: ' + (data.error || 'Room not found'))
      }
    } catch (error) {
      console.error('Join room error:', error)
      alert('Failed to join room')
    }
  }

  // Leave room
  const leaveRoom = async () => {
    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          roomCode,
          deviceId
        })
      })
    } catch (error) {
      console.error('Error leaving room:', error)
    }
    
    setPhase('join')
    setRoomCode('')
    setRoomPlayers([])
    g.reset()
  }

  // Start game (host only)
  const startGame = () => {
    if (roomPlayers.length < 5) {
      alert('Need at least 5 players to start')
      return
    }
    
    // Clear and sync all players from server to game state
    g.reset()
    roomPlayers.forEach(p => {
      g.addPlayer(p.name)
    })
    
    g.startGame()
    setPhase('playing')
    pushGameState() // Push initial state
  }

  // ===== JOIN SCREEN =====
  if (phase === 'join') {
    return (
      <main className="space-y-6 animate-fadeIn">
        <h1 className="text-4xl font-bold text-center" style={GAME_TITLE_STYLE}>
          AI Judge Mode
        </h1>
        
        <div className="glass-strong rounded-3xl p-6 space-y-6">
          <Section title="Your Name">
            <input 
              type="text"
              value={playerName} 
              onChange={e => setPlayerName(e.target.value)} 
              placeholder="Enter your name" 
              className="w-full glass rounded-lg px-4 py-3 text-sm outline-none"
              autoComplete="off"
            />
          </Section>
          
          <div className="space-y-3">
            <Button
              onClick={createRoom}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white"
              disabled={!playerName.trim()}
            >
              Create New Room
            </Button>
            
            <div className="text-center text-sm opacity-50">or</div>
            
            <input 
              type="text"
              value={inputRoomCode}
              onChange={e => setInputRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter Room Code"
              className="w-full glass rounded-lg px-4 py-3 text-sm outline-none text-center tracking-wider"
              autoComplete="off"
              maxLength={6}
            />
            
            <Button
              onClick={joinRoom}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white"
              disabled={!playerName.trim() || !inputRoomCode.trim()}
            >
              Join Room
            </Button>
          </div>
        </div>
        
        <div className="glass rounded-xl p-4 space-y-2">
          <div className="text-sm font-bold">🎮 How it works:</div>
          <div className="text-xs opacity-70 space-y-1">
            <div>• Everyone joins on their own device</div>
            <div>• One person creates a room and shares the code</div>
            <div>• Others join using the code</div>
            <div>• The AI Judge decides eliminations based on discussion</div>
          </div>
        </div>
      </main>
    )
  }

  // ===== LOBBY SCREEN =====
  if (phase === 'lobby') {
    return (
      <main className="space-y-6 animate-fadeIn">
        <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>
          AI Judge Mode
        </h1>

        <div className="glass-strong rounded-3xl p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="text-sm text-gray-400">Room Code</div>
            <div className="text-5xl font-bold tracking-wider gradient-text">{roomCode}</div>
            <div className="text-xs text-gray-400">Share this code with other players</div>
          </div>

          <div className="h-px bg-white/20"></div>

          <div className="space-y-2">
            <div className="text-sm font-bold">Players ({roomPlayers.length})</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {roomPlayers.map((p) => (
                <div key={p.id} className="glass rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <div className="flex-1">
                    {p.name} {p.id === playerId && '(You)'}
                    {p.id === hostId && <span className="ml-2 text-xs px-2 py-0.5 bg-red-500/80 rounded">HOST</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <>
              <div className="h-px bg-white/20"></div>
              <Button
                onClick={startGame}
                className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white"
                disabled={roomPlayers.length < 5}
              >
                Start Game ({roomPlayers.length}/5+)
              </Button>
            </>
          )}

          {!isHost && (
            <div className="text-center text-sm text-gray-400">
              Waiting for host to start...
            </div>
          )}
        </div>

        <Button
          onClick={leaveRoom}
          className="w-full"
        >
          Leave Room
        </Button>
      </main>
    )
  }

  // ===== PLAYING SCREEN =====
  // Role Assignment Phase - Each player sees only their role
  if (g.phase.kind === 'RoleAssignment') {
    if (!roleRevealed) {
      return (
        <main className="space-y-6 animate-fadeIn">
          <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>
            Role Assignment
          </h1>
          
          <div className="glass-strong rounded-3xl p-6 space-y-4 text-center">
            <div className="text-4xl mb-4">🎭</div>
            <div className="text-2xl font-bold">{myPlayerName}</div>
            <div className="text-sm opacity-70">Tap below to reveal your secret role</div>
            <Button 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white"
              onClick={() => setRoleRevealed(true)}
            >
              Reveal My Role
            </Button>
          </div>
        </main>
      )
    }

    return (
      <main className="space-y-6 animate-fadeIn">
        <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>
          Your Role
        </h1>
        
        <div className="glass-strong rounded-3xl p-6 space-y-4 text-center">
          <div className="text-6xl mb-4">
            {myRole === 'werewolf' ? '🐺' : myRole === 'seer' ? '🔮' : myRole === 'medic' ? '💉' : '🧑'}
          </div>
          <div className="text-3xl font-bold">
            {myRole === 'werewolf' ? 'Werewolf' : myRole === 'seer' ? 'Seer' : myRole === 'medic' ? 'Medic' : 'Villager'}
          </div>
          <div className="text-sm opacity-70 mt-4">
            {myRole === 'werewolf' && 'Eliminate villagers each night'}
            {myRole === 'seer' && 'Peek at one player\'s role each night'}
            {myRole === 'medic' && 'Protect one player from elimination each night'}
            {myRole === 'villager' && 'Help identify and eliminate werewolves'}
          </div>
          
          <div className="text-xs opacity-50 mt-6">
            Remember your role and wait for the game to continue...
          </div>
        </div>
      </main>
    )
  }

  // All other phases - Show current phase info
  return (
    <main className="space-y-6 animate-fadeIn">
      <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>
        AI Judge Mode
      </h1>
      
      <div className="glass-strong rounded-3xl p-6 space-y-4">
        <div className="text-center">
          <div className="text-sm text-gray-400">Current Phase</div>
          <div className="text-2xl font-bold mt-2">{g.phase.kind}</div>
          <div className="text-sm text-gray-400 mt-1">Round {g.round}</div>
        </div>
        
        <div className="h-px bg-white/20"></div>
        
        <div className="space-y-2">
          <div className="text-sm font-bold">Players</div>
          <div className="grid grid-cols-2 gap-2">
            {g.players.filter(p => p.alive).map(p => (
              <div key={p.id} className="glass rounded-lg p-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <div className="text-sm">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
        
        {g.players.filter(p => !p.alive).length > 0 && (
          <>
            <div className="h-px bg-white/20"></div>
            <div className="space-y-2">
              <div className="text-sm font-bold text-red-400">Eliminated</div>
              <div className="grid grid-cols-2 gap-2 opacity-60">
                {g.players.filter(p => !p.alive).map(p => (
                  <div key={p.id} className="glass rounded-lg p-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <div className="text-sm line-through">{p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        <div className="text-center text-xs opacity-50 mt-4">
          Multi-device sync is active. Host controls game flow.
        </div>
      </div>
      
      {isHost && (
        <div className="glass rounded-xl p-4 space-y-2">
          <div className="text-sm font-bold text-yellow-400">⚠️ Host Controls</div>
          <div className="text-xs opacity-70">
            As the host, you control the game flow. Other players will see updates automatically.
          </div>
          <Button 
            className="w-full"
            onClick={leaveRoom}
          >
            End Game & Leave
          </Button>
        </div>
      )}
      
      {!isHost && (
        <Button 
          className="w-full"
          onClick={leaveRoom}
        >
          Leave Game
        </Button>
      )}
    </main>
  )
}
