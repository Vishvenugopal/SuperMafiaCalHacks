"use client"
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { connectToRoom, startAgentTurn, endAgentTurn, getCurrentRoom, disconnectRoom, generateRoomCode, broadcastData, hasAgent, getPlayers } from '@/lib/livekit-room'
import type { Room, RemoteParticipant } from 'livekit-client'

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

export default function JudgeMode() {
  // Room state
  const [phase, setPhase] = useState<'join' | 'lobby' | 'playing'>('join')
  const [isHost, setIsHost] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [inputRoomCode, setInputRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<RemoteParticipant[]>([])
  const [agentPresent, setAgentPresent] = useState(false)

  // Game state
  const [isTalking, setIsTalking] = useState(false)
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null)
  const [gameMessages, setGameMessages] = useState<Array<{ sender: string; message: string }>>([])

  // Update participants list
  const updateParticipants = useCallback(() => {
    const currentRoom = getCurrentRoom()
    if (currentRoom) {
      const players = getPlayers(currentRoom)
      setParticipants(players)
      setAgentPresent(hasAgent(currentRoom))
    }
  }, [])

  // Handle data received from other participants or agent
  const handleDataReceived = useCallback((data: any, participant?: RemoteParticipant) => {
    console.log('Data received:', data, 'from:', participant?.identity)
    
    if (data.type === 'game_state') {
      // Handle game state updates
      if (data.currentSpeaker !== undefined) {
        setCurrentSpeaker(data.currentSpeaker)
      }
    } else if (data.type === 'message') {
      // Handle chat messages
      setGameMessages(prev => [...prev, { sender: participant?.name || 'Unknown', message: data.text }])
    }
  }, [])

  // Create a new room
  const createRoom = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name')
      return
    }

    const code = generateRoomCode()
    const connectedRoom = await connectToRoom(
      code,
      playerName.trim(),
      updateParticipants,
      updateParticipants,
      handleDataReceived
    )

    if (connectedRoom) {
      setRoom(connectedRoom)
      setRoomCode(code)
      setIsHost(true)
      setPhase('lobby')
      updateParticipants()
    } else {
      alert('Failed to create room. Please check your LiveKit configuration.')
    }
  }

  // Join an existing room
  const joinRoom = async () => {
    if (!playerName.trim() || !inputRoomCode.trim()) {
      alert('Please enter your name and room code')
      return
    }

    const connectedRoom = await connectToRoom(
      inputRoomCode.trim().toUpperCase(),
      playerName.trim(),
      updateParticipants,
      updateParticipants,
      handleDataReceived
    )

    if (connectedRoom) {
      setRoom(connectedRoom)
      setRoomCode(inputRoomCode.trim().toUpperCase())
      setIsHost(false)
      setPhase('lobby')
      updateParticipants()
    } else {
      alert('Failed to join room. Check the room code and try again.')
    }
  }

  // Start the game
  const startGame = () => {
    if (!agentPresent) {
      alert('Waiting for AI Judge to join the room...')
      return
    }
    setPhase('playing')
    broadcastGameState('playing', null)
  }

  // Broadcast game state to all participants
  const broadcastGameState = (gamePhase: string, speaker: string | null) => {
    if (room && isHost) {
      broadcastData(room, {
        type: 'game_state',
        phase: gamePhase,
        currentSpeaker: speaker,
      })
    }
  }

  // Start talking (push to talk)
  const handleStartTalking = async () => {
    if (!room) return
    
    // Check if someone else is talking
    if (currentSpeaker && currentSpeaker !== room.localParticipant.identity) {
      alert(`${currentSpeaker} is currently talking. Please wait your turn.`)
      return
    }

    const success = await startAgentTurn(room)
    if (success) {
      setIsTalking(true)
      setCurrentSpeaker(room.localParticipant.identity)
      
      // Broadcast that we're talking
      if (isHost) {
        broadcastGameState('playing', room.localParticipant.identity)
      }
      
      // Enable microphone
      await room.localParticipant.setMicrophoneEnabled(true)
    }
  }

  // Stop talking (release push to talk)
  const handleStopTalking = async () => {
    if (!room) return

    await endAgentTurn(room)
    await room.localParticipant.setMicrophoneEnabled(false)
    setIsTalking(false)
    setCurrentSpeaker(null)
    
    // Broadcast that we're done talking
    if (isHost) {
      broadcastGameState('playing', null)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectRoom()
    }
  }, [])

  // Update participants when room changes
  useEffect(() => {
    if (room) {
      updateParticipants()
      const interval = setInterval(updateParticipants, 2000)
      return () => clearInterval(interval)
    }
  }, [room, updateParticipants])

  // Render join screen
  if (phase === 'join') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 animate-fadeIn">
          <Link href="/" className="glass-strong rounded-lg px-3 py-1.5 text-sm hover:scale-105 transition-transform inline-block">
            ← Back
          </Link>
          
          <h1 className="text-5xl font-bold text-center" style={GAME_TITLE_STYLE}>
            AI Judge Mode
          </h1>

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
                Create New Room
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

          <div className="glass rounded-2xl p-4 text-sm text-gray-300 space-y-2">
            <div className="font-bold text-white">How to Play:</div>
            <ul className="space-y-1 text-xs">
              <li>• All players join from their own devices</li>
              <li>• Take turns talking to the AI Judge</li>
              <li>• Convince the Judge you're innocent</li>
              <li>• The Judge decides who to eliminate</li>
            </ul>
          </div>
        </div>
      </main>
    )
  }

  // Render lobby screen
  if (phase === 'lobby') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 animate-fadeIn">
          <h1 className="text-4xl font-bold text-center" style={GAME_TITLE_STYLE}>
            Room Lobby
          </h1>

          <div className="glass-strong rounded-3xl p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="text-sm text-gray-400">Room Code</div>
              <div className="text-5xl font-bold tracking-wider gradient-text">{roomCode}</div>
              <div className="text-xs text-gray-400">Share this code with other players</div>
            </div>

            <div className="h-px bg-white/20"></div>

            <div className="space-y-2">
              <div className="text-sm font-bold">Players in Room ({participants.length})</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {/* Local player */}
                <div className="glass rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <div className="font-medium">{playerName} (You)</div>
                  {isHost && <span className="text-xs bg-red-500/30 px-2 py-0.5 rounded">Host</span>}
                </div>
                
                {/* Remote players */}
                {participants.map((p) => (
                  <div key={p.identity} className="glass rounded-lg p-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <div>{p.name || p.identity}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/20"></div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold">AI Judge Status</div>
                <div className={`text-xs px-2 py-1 rounded ${agentPresent ? 'bg-green-500/30 text-green-300' : 'bg-yellow-500/30 text-yellow-300'}`}>
                  {agentPresent ? '✓ Connected' : 'Waiting...'}
                </div>
              </div>
              {!agentPresent && (
                <div className="text-xs text-gray-400">
                  Start the Python agent script to continue
                </div>
              )}
            </div>

            {isHost && (
              <>
                <div className="h-px bg-white/20"></div>
                <Button
                  onClick={startGame}
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white"
                  disabled={!agentPresent || participants.length < 1}
                >
                  Start Game
                </Button>
              </>
            )}
          </div>

          <Button
            onClick={() => {
              disconnectRoom()
              setPhase('join')
              setRoom(null)
            }}
            className="w-full"
          >
            Leave Room
          </Button>
        </div>
      </main>
    )
  }

  // Render game screen
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={GAME_TITLE_STYLE}>
            AI Judge
          </h1>
          <div className="text-xs glass-strong px-3 py-1.5 rounded-lg">
            Room: {roomCode}
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-6 space-y-4">
          {/* Current speaker indicator */}
          <div className="text-center">
            {currentSpeaker ? (
              <div className="space-y-2">
                <div className="text-xl font-bold text-red-400 animate-pulse">
                  {currentSpeaker === room?.localParticipant.identity ? 'You are speaking' : `${participants.find(p => p.identity === currentSpeaker)?.name || 'Someone'} is speaking`}
                </div>
                <div className="text-xs text-gray-400">Wait for them to finish...</div>
              </div>
            ) : (
              <div className="text-lg text-gray-400">
                Press and hold to talk to the Judge
              </div>
            )}
          </div>

          {/* Push to talk button */}
          <div className="flex flex-col items-center gap-4">
            <button
              onMouseDown={handleStartTalking}
              onMouseUp={handleStopTalking}
              onTouchStart={handleStartTalking}
              onTouchEnd={handleStopTalking}
              disabled={!!currentSpeaker && currentSpeaker !== room?.localParticipant.identity}
              className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl transition-all ${
                isTalking
                  ? 'bg-red-500 animate-pulse-glow scale-110'
                  : 'bg-gradient-to-br from-purple-600 to-purple-800 hover:scale-105'
              } disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl`}
            >
              🎙️
            </button>
            <div className="text-xs text-center text-gray-400">
              {isTalking ? 'Release to send' : 'Hold to talk'}
            </div>
          </div>

          {/* Players list */}
          <div className="space-y-2">
            <div className="text-sm font-bold">Players</div>
            <div className="grid grid-cols-2 gap-2">
              {/* Local player */}
              <div className="glass rounded-lg p-2 text-xs">
                {playerName} (You)
              </div>
              {participants.map((p) => (
                <div key={p.identity} className="glass rounded-lg p-2 text-xs">
                  {p.name || p.identity}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            disconnectRoom()
            setPhase('join')
            setRoom(null)
          }}
          className="w-full"
        >
          Leave Game
        </Button>
      </div>
    </main>
  )
}
