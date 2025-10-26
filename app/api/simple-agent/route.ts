import { NextResponse } from 'next/server'

// Simple in-memory agent state (in production, use Redis)
const roomAgents = new Map<string, {
  currentSpeaker: string | null
  conversationHistory: Array<{ player: string; message: string }>
}>()

function getOrCreateAgent(roomCode: string) {
  if (!roomAgents.has(roomCode)) {
    roomAgents.set(roomCode, {
      currentSpeaker: null,
      conversationHistory: []
    })
  }
  return roomAgents.get(roomCode)!
}

export async function POST(request: Request) {
  try {
    const { action, roomCode, playerIdentity, playerName } = await request.json()
    
    const agent = getOrCreateAgent(roomCode)
    
    switch (action) {
      case 'check_ready':
        // Check if agent is ready for this room
        return NextResponse.json({ 
          ready: true,
          hasPushToTalk: true,
          identity: 'simple-agent'
        })
      
      case 'start_turn':
        // Player wants to speak
        if (agent.currentSpeaker && agent.currentSpeaker !== playerIdentity) {
          return NextResponse.json({ 
            error: 'Someone else is speaking',
            currentSpeaker: agent.currentSpeaker 
          }, { status: 409 })
        }
        
        agent.currentSpeaker = playerIdentity
        console.log(`[${roomCode}] ${playerName} started speaking`)
        
        return NextResponse.json({ 
          status: 'listening',
          speaker: playerIdentity
        })
      
      case 'end_turn':
        // Player finished speaking - generate AI response
        console.log(`[${roomCode}] ${playerName} finished speaking`)
        
        // Add to history
        agent.conversationHistory.push({
          player: playerName || playerIdentity,
          message: 'Made their case'
        })
        
        // Call your existing AI endpoint
        try {
          const aiResponse = await fetch(`http://localhost:3000/api/host`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: `Player ${playerName || playerIdentity} has spoken to you, the AI Judge. Respond briefly and thoughtfully.`,
              gameContext: {
                phase: { kind: 'Discussion' },
                round: 1,
                alivePlayers: agent.conversationHistory.map(h => ({ name: h.player })),
              },
              provider: 'baseten'
            })
          })
          
          if (aiResponse.ok) {
            const data = await aiResponse.json()
            const response = data.answer || "I hear you. Please continue."
            
            agent.currentSpeaker = null
            
            return NextResponse.json({ 
              status: 'responded',
              message: response,
              speaker: null
            })
          }
        } catch (error) {
          console.error('AI call failed:', error)
        }
        
        // Fallback response
        agent.currentSpeaker = null
        return NextResponse.json({ 
          status: 'responded',
          message: "I'm listening carefully. Next player, make your case.",
          speaker: null
        })
      
      case 'cancel_turn':
        // Player cancelled
        console.log(`[${roomCode}] ${playerName} cancelled`)
        agent.currentSpeaker = null
        
        return NextResponse.json({ 
          status: 'cancelled',
          speaker: null
        })
      
      case 'get_state':
        // Get current state
        return NextResponse.json({
          currentSpeaker: agent.currentSpeaker,
          historyCount: agent.conversationHistory.length
        })
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Simple agent error:', error)
    return NextResponse.json({ 
      error: 'Agent error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Cleanup old rooms periodically (optional)
setInterval(() => {
  // In production, clean up rooms with no activity
  // For demo, this is fine
}, 60000)
