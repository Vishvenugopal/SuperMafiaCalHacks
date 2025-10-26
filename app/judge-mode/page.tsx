"use client"
/**
 * JUDGE MODE - Full Werewolf game with AI Judge voting
 * 
 * Based on the original Werewolf game but with these changes:
 * - Multi-device: Players join via room codes
 * - Judge voting: Only the AI Judge votes (not players)
 * - Players talk to Judge during discussion using LiveKit voice
 * - Narrator still exists for game flow
 * - Judge makes elimination decisions
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useGame } from '@/store/game'
import { Player } from '@/lib/types'
import { ttsSpeak, isTtsAvailable, startSttStream, stopSttStream } from '@/lib/voice'

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
} as const

function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button 
      {...props} 
      className={`glass-strong rounded-xl px-6 py-3 font-semibold transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
    >
      {children}
    </button>
  )
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
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
  
  // Judge state
  const [isTalking, setIsTalking] = useState(false)
  const [judgeResponse, setJudgeResponse] = useState('')
  const [hostResponse, setHostResponse] = useState<string>('')
  const [userTranscript, setUserTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const kbHoldingRef = useRef(false)
  const now = useNow(200)
  const timerCheckedRef = useRef(false)
  
  // Phase-specific state
  const [roleRevealed, setRoleRevealed] = useState(false)
  const [nightPlayerIndex, setNightPlayerIndex] = useState(0)
  const [nightRevealed, setNightRevealed] = useState(false)
  const [peekResult, setPeekResult] = useState<{ playerId: string; role: string } | null>(null)
  const [dayRevealShown, setDayRevealShown] = useState(false)
  const [dayRevealDone, setDayRevealDone] = useState(false)
  const [showNightIntro, setShowNightIntro] = useState(false)
  const [nightActionSubmitted, setNightActionSubmitted] = useState(false)
  const [peekCompleted, setPeekCompleted] = useState(false)
  
  // Get my player info
  const myPlayer = g.players.find(p => p.name === myPlayerName)
  const myRole = myPlayer?.role || 'villager'
  const amIAlive = myPlayer?.alive ?? false
  
  // Push current host snapshot so all clients hydrate (allow passing explicit state)
  const pushSnapshot = useCallback(async (overrideState?: any) => {
    try {
      const s = overrideState ?? useGame.getState()
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_game_state',
          roomCode,
          deviceId,
          gameState: {
            seed: s.seed,
            settings: s.settings,
            players: s.players,
            phase: s.phase,
            round: s.round,
            nightActions: s.nightActions,
            eventLog: s.eventLog,
          }
        })
      })
    } catch (e) {
      // ignore
    }
  }, [roomCode, deviceId])
  
  // Reset roleRevealed when entering RoleAssignment phase
  useEffect(() => {
    if (g.phase.kind === 'RoleAssignment') {
      setRoleRevealed(false)
      
      // Reset role tracking on server (host only)
      if (phase === 'playing' && isHost) {
        fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_phase_tracking',
            roomCode,
            deviceId,
            trackingType: 'roles'
          })
        })
      }
    }
    
    // Reset nightActionSubmitted and peekCompleted when entering NightStart
    if (g.phase.kind === 'NightStart') {
      setNightActionSubmitted(false)
      setPeekCompleted(false)
      
      // Reset night tracking on server (host only)
      if (phase === 'playing' && isHost) {
        fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_phase_tracking',
            roomCode,
            deviceId,
            trackingType: 'night'
          })
        })
      }
    }
  }, [g.phase.kind, phase, roomCode, deviceId, isHost])
  
  // Poll for room updates
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
            
            // Check if game has started and host snapshot is ready
            if (data.gamePhase === 'playing') {
              console.log('🎮 Game phase is playing!')
              console.log('   Has gameState:', !!data.gameState)
              console.log('   GameState:', data.gameState)
              
              if (data.gameState) {
                console.log('✅ Hydrating snapshot and switching to playing phase...')
                g.reset()
                g.hydrateFromHost(data.gameState)
                setPhase('playing')
                clearInterval(interval)
                return
              } else {
                console.log('⏳ Waiting for host to push gameState...')
              }
            }
            
            // Check if we're the host (in case it transferred)
            if (data.hostId === playerId) {
              if (!isHost) {
                setIsHost(true)
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
    }, 2000) // Poll every 2 seconds
    
    return () => clearInterval(interval)
  }, [phase, roomCode, deviceId, playerId, isHost])
  
  // Auto-mark dead players and villagers as complete (MUST be before early returns)
  useEffect(() => {
    if (g.phase.kind === 'NightStart' && !nightActionSubmitted) {
      if (!amIAlive || myRole === 'villager') {
        setNightActionSubmitted(true)
        fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_night_action_complete',
            roomCode,
            deviceId
          })
        })
      }
    }
  }, [g.phase.kind, nightActionSubmitted, amIAlive, myRole, roomCode, deviceId])
  
  // Poll for phase progression during gameplay (host only)
  useEffect(() => {
    if (phase !== 'playing' || !isHost) return
    
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
            // Auto-progress from RoleAssignment when all roles revealed
            if (g.phase.kind === 'RoleAssignment' && data.allRolesRevealed) {
              console.log('All roles revealed! Auto-progressing to night...')
              g.proceedFromRoleReveal()
              // Push updated host snapshot (fresh state)
              await pushSnapshot(useGame.getState())
            }
            
            // Auto-progress from NightStart when all actions complete
            if (g.phase.kind === 'NightStart' && data.allNightActionsComplete) {
              console.log('All night actions complete! Auto-progressing to day...')
              g.resolveNight()
              // Push updated host snapshot (fresh state)
              await pushSnapshot(useGame.getState())
            }
            
            // Auto-progress from PlayerTalking when timer expires
            if (g.phase.kind === 'PlayerTalking' && g.phase.endsAt <= Date.now()) {
              console.log('Player talking time expired! Auto-progressing to judge discussion...')
              g.startDiscussion()
              await pushSnapshot(useGame.getState())
            }
          }
        }
      } catch (error) {
        console.error('Failed to check phase progression:', error)
      }
    }, 1000) // Check every second for smooth UX
    
    return () => clearInterval(interval)
  }, [phase, isHost, roomCode, deviceId, g.phase.kind, g])

  // Poll for host state during gameplay (clients hydrate)
  useEffect(() => {
    if (phase !== 'playing' || isHost) return
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_state', roomCode, deviceId })
        })
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.gameState) {
            g.hydrateFromHost(data.gameState)
          }
        }
      } catch (e) {
        // no-op
      }
    }, 1200)
    return () => clearInterval(interval)
  }, [phase, isHost, roomCode, deviceId, g])
  
  // Create room (host)
  const createRoom = async () => {
    if (!playerName.trim()) {
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
        setHostId(data.playerId) // Creator is initially the host
        setRoomPlayers(data.players)
        setMyPlayerName(playerName.trim())
        setPhase('lobby')
      } else {
        // alert('Failed to create room: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Create room error:', error)
      // alert('Failed to create room')
    }
  }

  // Join room (non-host)
  const joinRoom = async () => {
    if (!playerName.trim() || !inputRoomCode.trim()) {
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
        // alert('Failed to join room: ' + (data.error || 'Room not found'))
      }
    } catch (error) {
      console.error('Join room error:', error)
      // alert('Failed to join room')
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
  const startGame = async () => {
    if (roomPlayers.length < 5) {
      return
    }
    
    try {
      // Tell server the game is starting
      const response = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_game',
          roomCode,
          deviceId
        })
      })
      
      const data = await response.json()
      
      if (!data.success) {
        // alert('Failed to start game: ' + (data.error || 'Unknown error'))
        return
      }
      
      // Clear and sync all players from server to game state (single atomic set)
      g.reset()
      g.setPlayersFromNames(roomPlayers.map(p => p.name))
      
      // Deterministic role assignment across devices using a shared seed
      const sharedSeed = Date.now()
      // Clamp role counts to ensure at least one villager exists (use fresh state)
      const sNow = useGame.getState()
      const total = sNow.players.length
      let werewolves = Math.max(1, Math.round(total * 0.25))
      let seers = sNow.settings.rolesEnabled.seer ?? 1
      let medics = sNow.settings.rolesEnabled.medic ?? 1
      werewolves = Math.min(werewolves, total)
      // Reduce special roles if they exceed player count
      const reduceUntilValid = () => {
        let special = werewolves + seers + medics
        while (special > total) {
          if (seers > 0) seers--
          else if (medics > 0) medics--
          else if (werewolves > 1) werewolves--
          special = werewolves + seers + medics
        }
      }
      reduceUntilValid()
      const rolesOverride = { werewolf: werewolves, seer: seers, medic: medics }
      g.startGameWithSeed(sharedSeed, { rolesEnabled: rolesOverride })
      
      // Push snapshot immediately using fresh state after mutation
      await pushSnapshot(useGame.getState())
      setPhase('playing')
    } catch (error) {
      console.error('Start game error:', error)
      // alert('Failed to start game')
    }
  }

  // Talk to Judge (voice interaction)
  const handleStartTalking = async () => {
    setIsTalking(true)
    setJudgeResponse('Judge is listening...')
    setUserTranscript('')
    
    // Start voice recognition
    const ok = startSttStream(
      (partial) => setUserTranscript(partial),
      async (finalText) => {
        setIsTalking(false)
        if (finalText && finalText.trim()) {
          await handleJudgeQuestion(finalText.trim())
        }
      }
    )
    
    if (!ok) {
      setIsTalking(false)
      setJudgeResponse('Could not start microphone')
    }
  }

  const handleStopTalking = async () => {
    stopSttStream(true)
    setIsTalking(false)
  }
  
  // Ask Judge a question
  const handleJudgeQuestion = async (question: string) => {
    setJudgeResponse('Judge is thinking...')
    
    try {
      const gameContext = {
        phase: g.phase,
        round: g.round,
        alivePlayers: g.players.filter(p => p.alive).map(p => ({ id: p.id, name: p.name })),
        speaker: myPlayerName
      }
      
      const res = await fetch('/api/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: `Player ${myPlayerName} says: "${question}". Respond as the AI Judge.`,
          gameContext,
          provider: g.settings.aiProvider
        })
      })
      
      const data = await res.json()
      const answer = String(data.answer || 'I have noted your testimony.')
      setJudgeResponse(answer)
      await ttsSpeak(answer)
    } catch (error) {
      console.error('Judge error:', error)
      setJudgeResponse('The Judge is temporarily unavailable.')
    }
  }

  // Join screen
  if (phase === 'join') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 animate-fadeIn">
          <Link href="/" className="glass-strong rounded-lg px-3 py-1.5 text-sm hover:scale-105 transition-transform inline-block">
            ← Back
          </Link>
          
          <h1 className="text-5xl font-bold text-center" style={GAME_TITLE_STYLE}>
            Judge Mode
          </h1>

          <div className="glass rounded-2xl p-4 text-sm text-gray-300 space-y-2">
            <div className="font-bold text-white">🎮 Full Werewolf + AI Judge</div>
            <ul className="space-y-1 text-xs">
              <li>• Everyone on their own device</li>
              <li>• Full roles and game phases</li>
              <li>• AI Judge decides who to eliminate</li>
              <li>• Talk to Judge with voice</li>
            </ul>
          </div>

          <div className="glass-strong rounded-3xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full glass-strong rounded-lg px-4 py-3 outline-none text-white"
                maxLength={20}
              />
            </div>

            <div className="space-y-3">
              <Button
                onClick={createRoom}
                className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white"
                disabled={!playerName.trim()}
              >
                Create New Room (Host)
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 glass-strong rounded text-gray-400">or</span>
                </div>
              </div>

              <input
                type="text"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="w-full glass-strong rounded-lg px-4 py-3 outline-none text-white text-center uppercase tracking-wider"
                maxLength={6}
              />

              <Button
                onClick={joinRoom}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white"
                disabled={!playerName.trim() || !inputRoomCode.trim()}
              >
                Join Room
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Lobby screen
  if (phase === 'lobby') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 animate-fadeIn">
          <h1 className="text-4xl font-bold text-center" style={GAME_TITLE_STYLE}>
            Game Lobby
          </h1>

          <div className="glass-strong rounded-3xl p-6 space-y-6">
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
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs opacity-70 mb-1">🐺 Werewolves</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={g.settings.rolesEnabled.werewolf ?? 1}
                      onChange={e => g.updateRolesEnabled('werewolf', Number(e.target.value))}
                      className="w-full glass-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs opacity-70 mb-1">🔮 Seers</label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      value={g.settings.rolesEnabled.seer ?? 1}
                      onChange={e => g.updateRolesEnabled('seer', Number(e.target.value))}
                      className="w-full glass-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs opacity-70 mb-1">💉 Medics</label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      value={g.settings.rolesEnabled.medic ?? 1}
                      onChange={e => g.updateRolesEnabled('medic', Number(e.target.value))}
                      className="w-full glass-strong rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs opacity-70 mb-1">🤖 AI Provider</label>
                  <select
                    value={g.settings.aiProvider}
                    onChange={e => g.updateSettings({ aiProvider: e.target.value as any })}
                    className="w-full glass-strong rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="baseten">Baseten</option>
                    <option value="janitorai">JanitorAI</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
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

          <Button onClick={leaveRoom} className="w-full">Leave Room</Button>
        </div>
      </main>
    )
  }

  // ===== ROLE ASSIGNMENT - Each device sees only their role =====
  if (g.phase.kind === 'RoleAssignment') {
    if (!roleRevealed) {
      return (
        <main className="min-h-screen p-6 flex items-center justify-center">
          <div className="max-w-md w-full space-y-6">
            <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Role Assignment</h1>
            <div className="glass-strong rounded-3xl p-8 space-y-6 text-center">
              <div className="text-5xl">🎭</div>
              <div className="text-2xl font-bold">{myPlayerName}</div>
              <div className="text-sm opacity-70">Tap below to reveal your secret role</div>
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                onClick={async () => {
                  setRoleRevealed(true)
                  
                  // Mark role as revealed on server
                  await fetch('/api/room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'mark_role_revealed',
                      roomCode,
                      deviceId
                    })
                  })
                }}
              >
                Reveal My Role
              </Button>
            </div>
          </div>
        </main>
      )
    }

    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Your Role</h1>
          <div className="glass-strong rounded-3xl p-8 space-y-6 text-center">
            <div className="text-7xl mb-4">
              {myRole === 'werewolf' ? '🐺' : myRole === 'seer' ? '🔮' : myRole === 'medic' ? '💉' : '🧑'}
            </div>
            <div className="text-4xl font-bold">
              {myRole === 'werewolf' ? 'Werewolf' : myRole === 'seer' ? 'Seer' : myRole === 'medic' ? 'Medic' : 'Villager'}
            </div>
            <div className="text-sm opacity-70 mt-4 space-y-2">
              {myRole === 'werewolf' && <div>Eliminate villagers each night. Coordinate with other werewolves.</div>}
              {myRole === 'seer' && <div>Peek at one player's role each night to identify werewolves.</div>}
              {myRole === 'medic' && <div>Protect one player from elimination each night.</div>}
              {myRole === 'villager' && <div>Help identify and eliminate werewolves through discussion.</div>}
            </div>
            <div className="text-xs opacity-50 mt-6 p-4 glass rounded-lg">
              Remember your role! Game will automatically continue when everyone is ready.
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ===== NIGHT START - Each player takes their action =====
  if (g.phase.kind === 'NightStart') {
    const alive = g.players.filter(p => p.alive)
    
    // If I'm not alive, auto-mark as complete and show waiting screen
    if (!amIAlive) {
      useEffect(() => {
        // Auto-mark dead players as complete
        fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_night_action_complete',
            roomCode,
            deviceId
          })
        })
      }, [roomCode, deviceId])
      
      return (
        <main className="min-h-screen p-6 flex items-center justify-center">
          <div className="max-w-md w-full space-y-6">
            <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Night {g.round}</h1>
            <div className="glass-strong rounded-3xl p-8 space-y-4 text-center">
              <div className="text-5xl">💀</div>
              <div className="text-xl">You are eliminated</div>
              <div className="text-sm opacity-70">Wait for other players...</div>
            </div>
          </div>
        </main>
      )
    }

    // Show action based on my role
    if (myRole === 'werewolf') {
      return (
        <main className="min-h-screen p-6">
          <div className="max-w-md mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Night {g.round}</h1>
            <div className="glass-strong rounded-3xl p-6 space-y-4">
              <div className="text-center text-4xl">🐺</div>
              <div className="text-center text-2xl font-bold">Werewolf</div>
              {nightActionSubmitted ? (
                <div className="text-center space-y-4">
                  <div className="text-5xl">✨</div>
                  <div className="text-xl">Target Selected</div>
                  <div className="text-sm opacity-70">Wait for day phase...</div>
                </div>
              ) : (
                <div>
                  <div className="text-center text-sm opacity-70 mb-4">Select a player to eliminate</div>
                  <div className="grid grid-cols-2 gap-3">
                {alive.filter(p => p.role !== 'werewolf').map(p => (
                  <button 
                    key={p.id} 
                    onClick={async () => {
                      g.chooseKill(p.id)
                      
                      // Mark night action complete
                      await fetch('/api/room', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'mark_night_action_complete',
                          roomCode,
                          deviceId
                        })
                      })
                      
                      setNightActionSubmitted(true)
                    }}
                    className="glass rounded-xl p-4 hover:bg-red-500/20 transition-colors"
                  >
                    <div className="text-center font-medium">{p.name}</div>
                  </button>
                ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )
    }

    if (myRole === 'seer') {
      return (
        <main className="min-h-screen p-6">
          <div className="max-w-md mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Night {g.round}</h1>
            <div className="glass-strong rounded-3xl p-6 space-y-4">
              <div className="text-center text-4xl">🔮</div>
              <div className="text-center text-2xl font-bold">Seer Vision</div>
              {nightActionSubmitted ? (
                <div className="text-center space-y-4">
                  <div className="text-5xl">✨</div>
                  <div className="text-xl">Vision Complete</div>
                  <div className="text-sm opacity-70">Wait for day phase...</div>
                </div>
              ) : peekResult ? (
                <div>
                  <div className="text-center text-sm opacity-70 mb-4">Investigation Result</div>
                  <div className="glass rounded-xl p-6 space-y-3">
                    <div className="text-center text-xl font-bold">{peekResult.playerId}</div>
                    <div className="text-center text-3xl">
                      {peekResult.role === 'werewolf' ? '🐺' : '🧑'}
                    </div>
                    <div className="text-center font-bold text-xl">
                      {peekResult.role === 'werewolf' ? 'WEREWOLF!' : 'Not a werewolf'}
                    </div>
                    <Button 
                      className="w-full mt-4"
                      onClick={async () => {
                        setPeekResult(null)
                        
                        // Mark night action complete
                        await fetch('/api/room', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'mark_night_action_complete',
                            roomCode,
                            deviceId
                          })
                        })
                        
                        setNightActionSubmitted(true)
                      }}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-center text-sm opacity-70 mb-4">Choose a player to investigate</div>
                  <div className="grid grid-cols-2 gap-3">
                    {alive.filter(p => p.id !== myPlayer?.id).map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => {
                          g.choosePeek(p.id)
                          const targetRole = p.role || 'villager'
                          setPeekResult({ playerId: p.name, role: targetRole })
                        }}
                        className="glass rounded-xl p-4 hover:bg-purple-500/20 transition-colors"
                      >
                        <div className="text-center font-medium">{p.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )
    }

    if (myRole === 'medic') {
      return (
        <main className="min-h-screen p-6">
          <div className="max-w-md mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Night {g.round}</h1>
            <div className="glass-strong rounded-3xl p-6 space-y-4">
              <div className="text-center text-4xl">💉</div>
              <div className="text-center text-2xl font-bold">Medic Protection</div>
              {nightActionSubmitted ? (
                <div className="text-center space-y-4">
                  <div className="text-5xl">✨</div>
                  <div className="text-xl">Protection Set</div>
                  <div className="text-sm opacity-70">Wait for day phase...</div>
                </div>
              ) : (
                <div>
                  <div className="text-center text-sm opacity-70 mb-4">Choose a player to protect from elimination</div>
                  <div className="grid grid-cols-2 gap-3">
                    {alive.map(p => (
                      <button 
                        key={p.id} 
                        onClick={async () => {
                          g.chooseProtect(p.id)
                          
                          // Mark night action complete
                          await fetch('/api/room', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'mark_night_action_complete',
                              roomCode,
                              deviceId
                            })
                          })
                          
                          setNightActionSubmitted(true)
                        }}
                        className="glass rounded-xl p-4 hover:bg-green-500/20 transition-colors"
                      >
                        <div className="text-center font-medium">{p.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )
    }

    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Night {g.round}</h1>
          <div className="glass-strong rounded-3xl p-8 space-y-4 text-center">
            <div className="text-5xl">🧑</div>
            <div className="text-2xl font-bold">Villager</div>
            <div className="text-sm opacity-70">You have no night action</div>
            <div className="text-xs opacity-50 mt-6 p-4 glass rounded-lg">
              Wait for the day phase...
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ===== DAY START - Show who died =====
  if (g.phase.kind === 'DayStart') {
    const round = g.round
    const events = g.eventLog.filter(e => e.round === round && e.public)
    const death = events.find(e => e.type === 'night_kill')
    const victim = g.players.find(p => p.id === death?.data.playerId)
    
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Day {g.round} Dawns</h1>
          
          {death && victim ? (
            <div className="glass-strong rounded-3xl p-8 space-y-6">
              <div className="text-center text-xl opacity-80">The village awakens to a horrifying discovery...</div>
              <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-6 space-y-3">
                <div className="text-center text-5xl">💀</div>
                <div className="text-center text-3xl font-bold text-red-400">{victim.name}</div>
                <div className="text-center text-xl text-red-300">has been eliminated</div>
                <div className="text-center text-sm opacity-70">Killed during the night</div>
              </div>
            </div>
          ) : (
            <div className="glass-strong rounded-3xl p-8 space-y-6">
              <div className="text-center text-xl opacity-80">The village awakens...</div>
              <div className="bg-green-900/30 border-2 border-green-500 rounded-xl p-6 space-y-3">
                <div className="text-center text-5xl">✨</div>
                <div className="text-center text-2xl font-bold text-green-400">Everyone Survived!</div>
                <div className="text-center text-sm opacity-70">No one was killed during the night</div>
              </div>
            </div>
          )}

          {isHost && (
            <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white" onClick={async () => {
              g.startPlayerTalking()
              await pushSnapshot(useGame.getState())
            }}>
              Start Player Discussion
            </Button>
          )}
          {!isHost && (
            <div className="text-center text-sm opacity-70">Waiting for host to start player discussion...</div>
          )}
        </div>
      </main>
    )
  }

  // ===== PLAYER TALKING - Players discuss among themselves =====
  if (g.phase.kind === 'PlayerTalking') {
    const endsAt = g.phase.endsAt
    const remain = Math.max(0, Math.round((endsAt - now) / 1000))
    const alivePlayers = g.players.filter(p => p.alive)
    
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold" style={GAME_TITLE_STYLE}>Player Discussion</h1>
            <div className="text-5xl font-bold text-blue-400">{Math.floor(remain / 60)}:{(remain % 60).toString().padStart(2, '0')}</div>
            <div className="text-sm opacity-70">Discuss among yourselves who might be the werewolf</div>
          </div>

          <div className="glass-strong rounded-3xl p-6 space-y-4">
            <div className="text-center text-lg font-bold">💬 Open Discussion</div>
            <div className="text-center text-sm opacity-70">
              Talk with other players freely. Use voice chat, text, or any communication method.
            </div>
            <div className="text-xs text-yellow-400 text-center">
              💡 Tip: Use headphones to prevent audio echo if using speakers
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {alivePlayers.map(p => (
                <div key={p.id} className="glass rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">{p.role === 'werewolf' ? '🐺' : '🧑'}</div>
                  <div className="font-medium">{p.name}</div>
                  {p.name === myPlayerName && <div className="text-xs text-blue-400 mt-1">(You)</div>}
                </div>
              ))}
            </div>

            <div className="text-xs opacity-50 text-center mt-4">
              {remain > 0 ? 
                `Time will automatically advance to Judge phase in ${remain}s` : 
                'Advancing to Judge phase...'
              }
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ===== DISCUSSION - Talk to Judge =====
  if (g.phase.kind === 'Discussion') {
    const endsAt = g.phase.endsAt || 0
    const remain = Math.max(0, Math.round((endsAt - now) / 1000))
    const alivePlayers = g.players.filter(p => p.alive)
    
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={GAME_TITLE_STYLE}>Discussion</h1>
            <div className="text-2xl font-bold">{remain}s</div>
          </div>

          {/* Players Status */}
          <div className="glass rounded-2xl p-4">
            <div className="text-sm font-bold mb-3 opacity-70">Players ({alivePlayers.length} alive)</div>
            <div className="grid grid-cols-3 gap-2">
              {alivePlayers.map(p => (
                <div key={p.id} className="glass rounded-lg p-2 text-center">
                  <div className="text-xs font-medium truncate">{p.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Judge Response */}
          {judgeResponse && (
            <div className="glass-strong rounded-2xl p-6">
              <div className="text-sm font-bold text-red-400 mb-2">⚖️ Judge:</div>
              <div className="text-white leading-relaxed">{judgeResponse}</div>
            </div>
          )}

          {/* Talk to Judge */}
          <div className="glass-strong rounded-3xl p-8 space-y-6">
            <div className="text-center text-xl font-bold">Make Your Case to the Judge</div>
            
            {/* Live Transcript */}
            {userTranscript && (
              <div className="glass rounded-xl p-4 min-h-[60px]">
                <div className="text-sm text-gray-400 mb-1">You're saying:</div>
                <div className="text-white">{userTranscript}</div>
              </div>
            )}
            
            <div className="flex flex-col items-center gap-4">
              <button
                onMouseDown={handleStartTalking}
                onMouseUp={handleStopTalking}
                onMouseLeave={isTalking ? handleStopTalking : undefined}
                onTouchStart={handleStartTalking}
                onTouchEnd={handleStopTalking}
                onTouchCancel={isTalking ? handleStopTalking : undefined}
                className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl transition-all shadow-2xl select-none ${
                  isTalking
                    ? 'bg-red-500 animate-pulse scale-110'
                    : 'bg-green-600 hover:bg-green-500 hover:scale-105'
                }`}
              >
                {isTalking ? '🎤' : '🔇'}
              </button>
              <div className="text-sm text-center text-gray-400">
                {isTalking ? '🔴 Speaking... (Release to send)' : '🟢 Hold to speak to Judge'}
              </div>
              {!window.isSecureContext && (
                <div className="text-xs text-yellow-400 text-center max-w-xs">
                  ⚠️ Mic may not work on non-HTTPS connections. Use headphones to prevent echo.
                </div>
              )}
            </div>
          </div>

          {isHost && (
            <Button
              onClick={async () => {
                g.startVoting()
                await pushSnapshot(useGame.getState())
              }}
              className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white"
            >
              End Discussion → Judge Decides
            </Button>
          )}
        </div>
      </main>
    )
  }

  // AI Judge makes elimination decision
  const makeJudgeDecision = async () => {
    try {
      const alivePlayers = g.players.filter(p => p.alive)
      
      const gameContext = {
        phase: g.phase,
        round: g.round,
        alivePlayers: alivePlayers.map(p => ({ id: p.id, name: p.name })),
        recentEvents: g.eventLog.slice(-5)
      }
      
      const res = await fetch('/api/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `You are the AI Judge. Based on the discussion, decide who to eliminate. Players: ${alivePlayers.map(p => p.name).join(', ')}. Respond with just the player name to eliminate, or "ABSTAIN" if no one should be eliminated. Be fair but decisive.`,
          gameContext,
          provider: g.settings.aiProvider
        })
      })
      
      const data = await res.json()
      const decision = String(data.answer || '').trim()
      
      // Parse decision
      if (decision.toUpperCase().includes('ABSTAIN')) {
        // Judge abstains - simulate abstain vote
        if (g.phase.kind === 'Voting') {
          for (let i = 0; i < g.phase.voterQueue.length; i++) {
            g.castVoteForCurrent(null)
          }
        }
      } else {
        // Find player by name in decision
        const targetPlayer = alivePlayers.find(p => 
          decision.toLowerCase().includes(p.name.toLowerCase())
        )
        
        if (targetPlayer && g.phase.kind === 'Voting') {
          // Cast all votes for this player
          for (let i = 0; i < g.phase.voterQueue.length; i++) {
            g.castVoteForCurrent(targetPlayer.id)
          }
        } else {
          // Default to abstain if can't parse
          if (g.phase.kind === 'Voting') {
            for (let i = 0; i < g.phase.voterQueue.length; i++) {
              g.castVoteForCurrent(null)
            }
          }
        }
      }
      
      // Resolve the vote
      g.resolveVote()
      await pushSnapshot(useGame.getState())
    } catch (error) {
      console.error('Judge decision error:', error)
      // Default to abstain on error
      if (g.phase.kind === 'Voting') {
        const firstVoter = Object.keys(g.phase.votes)[0]
        if (firstVoter) {
          g.castVoteForCurrent(null)
        }
      }
      g.resolveVote()
      await pushSnapshot(useGame.getState())
    }
  }

  // ===== VOTING - Judge Decides (AI) =====
  if (g.phase.kind === 'Voting') {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <div className="glass-strong rounded-3xl p-8 space-y-6 text-center">
            <div className="text-5xl animate-pulse">⚖️</div>
            <div className="text-2xl font-bold">The Judge is Deliberating</div>
            <div className="text-sm opacity-70">The AI Judge is analyzing the discussion and making a decision...</div>
            {isHost && (
              <Button className="w-full mt-6" onClick={makeJudgeDecision}>
                Let Judge Decide (Host)
              </Button>
            )}
          </div>
        </div>
      </main>
    )
  }

  // ===== LYNCH RESOLVE - Show Judge's decision =====
  if (g.phase.kind === 'LynchResolve') {
    const round = g.round
    const lynch = [...g.eventLog].reverse().find(e => e.type === 'lynch' && e.round === round)
    const victim = g.players.find(p => p.id === lynch?.data.playerId)
    
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-3xl font-bold text-center" style={GAME_TITLE_STYLE}>Judge's Decision</h1>
          
          {lynch && victim ? (
            <div className="glass-strong rounded-3xl p-8 space-y-6">
              <div className="text-center text-xl opacity-80">The Judge has made their decision...</div>
              <div className="bg-orange-900/30 border-2 border-orange-500 rounded-xl p-6 space-y-3">
                <div className="text-center text-5xl">🔥</div>
                <div className="text-center text-3xl font-bold text-orange-400">{victim.name}</div>
                <div className="text-center text-xl text-orange-300">has been eliminated</div>
                <div className="text-center text-sm opacity-70">By order of the Judge</div>
              </div>
            </div>
          ) : (
            <div className="glass-strong rounded-3xl p-8 space-y-6">
              <div className="text-center text-xl opacity-80">The Judge has made their decision...</div>
              <div className="bg-blue-900/30 border-2 border-blue-500 rounded-xl p-6 space-y-3">
                <div className="text-center text-5xl">⚖️</div>
                <div className="text-center text-2xl font-bold text-blue-400">No Elimination</div>
                <div className="text-center text-sm opacity-70">The Judge has chosen to abstain</div>
              </div>
            </div>
          )}
          
          {isHost && (
            <Button className="w-full" onClick={async () => {
              g.continueAfterLynch()
              await pushSnapshot(useGame.getState())
            }}>
              Continue to Night
            </Button>
          )}
        </div>
      </main>
    )
  }

  // ===== GAME OVER =====
  if (g.phase.kind === 'GameOver') {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-4xl font-bold text-center" style={GAME_TITLE_STYLE}>Game Over</h1>
          
          <div className="glass-strong rounded-3xl p-8 space-y-6 text-center">
            <div className="text-6xl">
              {g.phase.winners === 'town' ? '👥' : '🐺'}
            </div>
            <div className="text-3xl font-bold">
              {g.phase.winners === 'town' ? 'Villagers Win!' : 'Werewolves Win!'}
            </div>
            
            <div className="h-px bg-white/20 my-4"></div>
            
            <div className="space-y-2">
              <div className="text-sm font-bold opacity-70">Final Players:</div>
              {g.players.map(p => (
                <div key={p.id} className={`glass rounded-lg p-3 ${!p.alive ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-xs">
                      {p.role === 'werewolf' ? '🐺' : p.role === 'seer' ? '🔮' : p.role === 'medic' ? '💉' : '🧑'}
                      {' '}
                      {p.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button className="flex-1" onClick={leaveRoom}>
                Leave Room
              </Button>
              {isHost && (
                <Button className="flex-1 bg-gradient-to-r from-red-600 to-red-800 text-white" onClick={() => {
                  g.reset()
                  setPhase('lobby')
                  setRoleRevealed(false)
                }}>
                  New Game
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Default/fallback - Loading or unknown phase
  if (phase === 'playing' && g.phase.kind === 'Lobby') {
    // Still loading/hydrating
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="glass-strong rounded-3xl p-8 text-center space-y-4">
            <div className="text-5xl animate-pulse">⏳</div>
            <div className="text-xl">Loading game...</div>
            <div className="text-sm opacity-70">Syncing with host</div>
          </div>
        </div>
      </main>
    )
  }
  
  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="glass-strong rounded-3xl p-8 text-center">
          <div className="text-xl">Unknown phase: {g.phase.kind}</div>
          {isHost && (
            <Button className="w-full mt-4" onClick={leaveRoom}>Leave Game</Button>
          )}
        </div>
      </div>
    </main>
  )
}
