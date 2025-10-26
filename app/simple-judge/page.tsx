"use client"
import { useState, useEffect } from 'react'
import Link from 'next/link'

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

export default function SimpleJudgeMode() {
  const [phase, setPhase] = useState<'join' | 'playing'>('join')
  const [roomCode, setRoomCode] = useState('')
  const [inputRoomCode, setInputRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerIdentity, setPlayerIdentity] = useState('')
  
  const [isTalking, setIsTalking] = useState(false)
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null)
  const [judgeResponse, setJudgeResponse] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Create room
  const createRoom = () => {
    if (!playerName.trim()) {
      alert('Please enter your name')
      return
    }
    
    const code = generateRoomCode()
    const identity = `${playerName}_${Date.now()}`
    
    setRoomCode(code)
    setPlayerIdentity(identity)
    setPhase('playing')
    setJudgeResponse(`Welcome ${playerName}! The AI Judge is ready. Hold the microphone to speak.`)
  }

  // Join room
  const joinRoom = () => {
    if (!playerName.trim() || !inputRoomCode.trim()) {
      alert('Please enter your name and room code')
      return
    }
    
    const identity = `${playerName}_${Date.now()}`
    
    setRoomCode(inputRoomCode.trim().toUpperCase())
    setPlayerIdentity(identity)
    setPhase('playing')
    setJudgeResponse(`${playerName} joined! The AI Judge is listening. Hold the microphone to speak.`)
  }

  // Start talking
  const handleStartTalking = async () => {
    if (isProcessing) return
    
    try {
      const response = await fetch('/api/simple-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_turn',
          roomCode,
          playerIdentity,
          playerName
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setIsTalking(true)
        setCurrentSpeaker(playerIdentity)
        setJudgeResponse('The Judge is listening...')
      } else {
        alert(data.error || 'Someone else is speaking')
      }
    } catch (error) {
      console.error('Error starting turn:', error)
    }
  }

  // Stop talking and get response
  const handleStopTalking = async () => {
    setIsProcessing(true)
    setJudgeResponse('Judge is thinking...')
    
    try {
      const response = await fetch('/api/simple-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end_turn',
          roomCode,
          playerIdentity,
          playerName
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.message) {
        setJudgeResponse(data.message)
      } else {
        setJudgeResponse('Please continue...')
      }
    } catch (error) {
      console.error('Error ending turn:', error)
      setJudgeResponse('The Judge is ready for the next player.')
    } finally {
      setIsTalking(false)
      setCurrentSpeaker(null)
      setIsProcessing(false)
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
            AI Judge Mode
          </h1>
          
          <div className="glass rounded-2xl p-4 text-sm text-gray-300 space-y-2">
            <div className="font-bold text-white">✨ No Setup Required!</div>
            <ul className="space-y-1 text-xs">
              <li>• Everyone on their own device</li>
              <li>• Take turns talking to AI Judge</li>
              <li>• Judge uses your Baseten/JanitorAI</li>
              <li>• Just click and play!</li>
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
                Join Room {(!playerName.trim() || !inputRoomCode.trim()) ? '(Enter both)' : ''}
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Game screen
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

        <div className="glass-strong rounded-3xl p-6 space-y-6">
          {/* Judge response */}
          <div className="glass rounded-2xl p-4 min-h-[120px]">
            <div className="text-sm font-bold text-red-400 mb-2">AI Judge says:</div>
            <div className="text-white leading-relaxed">
              {judgeResponse || 'Press and hold the microphone to speak...'}
            </div>
          </div>

          {/* Push to talk button */}
          <div className="flex flex-col items-center gap-4">
            <button
              onMouseDown={handleStartTalking}
              onMouseUp={handleStopTalking}
              onTouchStart={handleStartTalking}
              onTouchEnd={handleStopTalking}
              disabled={isProcessing || (currentSpeaker !== null && currentSpeaker !== playerIdentity)}
              className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl transition-all ${
                isTalking
                  ? 'bg-red-500 animate-pulse-glow scale-110'
                  : 'bg-gradient-to-br from-purple-600 to-purple-800 hover:scale-105'
              } disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl`}
            >
              🎙️
            </button>
            <div className="text-xs text-center text-gray-400">
              {isProcessing 
                ? 'Processing...' 
                : isTalking 
                  ? 'Release to send' 
                  : 'Hold to talk'}
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-gray-400 text-center space-y-1">
            <div>Press and hold to talk to the Judge</div>
            <div>Release when you're done speaking</div>
            <div>The Judge will respond with their thoughts</div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => {
              setPhase('join')
              setRoomCode('')
              setJudgeResponse('')
            }}
            className="flex-1"
          >
            Leave Room
          </Button>
          
          <Button
            onClick={() => {
              navigator.clipboard.writeText(roomCode)
              alert(`Room code ${roomCode} copied!`)
            }}
            className="flex-1"
          >
            Copy Code
          </Button>
        </div>
      </div>
    </main>
  )
}
